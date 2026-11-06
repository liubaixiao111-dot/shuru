import fs from "node:fs";
import path from "node:path";
import { engineDir } from "./engine";

/**
 * 宿主提示词：直接使用引擎自带的 SKILL.md 与 references 原文，
 * 只去掉“怎么在命令行里调用运行时”的部分（书入程序代劳），并加一段宿主说明。
 */

const cache = new Map<string, string>();
function read(rel: string) {
  const p = path.join(engineDir(), rel);
  if (!cache.has(p)) cache.set(p, fs.readFileSync(p, "utf8"));
  return cache.get(p)!;
}

const DROP_SECTIONS = ["## 调用运行时", "## 第一次", "## 命令与别名", "## 参考资料"];

/** SKILL.md 去掉 frontmatter 和命令行相关的章节 */
export function skillCore() {
  const raw = read("SKILL.md").replace(/^---[\s\S]*?---\s*/, "");
  const parts = raw.split(/\n(?=## )/);
  return parts.filter((p) => !DROP_SECTIONS.some((h) => p.startsWith(h))).join("\n");
}

const HOST_PREFACE = [
  "你在中文互动小说 App「书入」里担任下面这个 Skill 的宿主模型。",
  "运行时由书入程序替你调用：程序把运行时返回的上下文、模板和结果交给你，你只按每次“本次任务”的要求输出。",
  "原文里关于“调用运行时”“攒着记录”“什么时候先记录”的说明，以本次任务为准：书入每个回合都是先记录、再按运行时的结果写正文。",
  "原文里提到的命令、字段名、数值、错误码一律不出现在正文里。",
].join("\n");

export function systemPrompt(kind: "record" | "write") {
  const parts = [
    HOST_PREFACE,
    "",
    "# Skill 原文",
    skillCore(),
    "",
    "# 完整叙事规则（references/narrative.md）",
    read("references/narrative.md"),
    "",
    "# 少用的流程（references/flows.md）",
    read("references/flows.md"),
  ];
  if (kind === "record") {
    parts.push("", "# 操作与提交字段（references/operations.md）", read("references/operations.md"));
  }
  return parts.join("\n");
}

export interface RecentTurn {
  turn: number;
  text: string;
}

function recentBlock(recent: RecentTurn[]) {
  if (!recent.length) return "（还没有正文）";
  return recent.map((r) => `【第 ${r.turn} 回合正文】\n${r.text}`).join("\n\n");
}

// 紧凑 JSON：不缩进，省下大约两成的 token
const j = (v: unknown) => JSON.stringify(v);

/** 每回合正文的篇幅（覆盖原文里“约 300–700 字”的说法） */
export type TurnLength = "short" | "medium" | "long";
export const LENGTHS: Record<TurnLength, { words: string; maxTokens: number }> = {
  short: { words: "300–700 字", maxTokens: 1500 },
  medium: { words: "1000–1500 字", maxTokens: 3000 },
  long: { words: "1800–2500 字", maxTokens: 4500 },
};
export const DEFAULT_LENGTH: TurnLength = "medium";

/**
 * 完整上下文里基本不变的部分（世界、背景、地点、名字池、标签）放在用户消息最前面，
 * 和系统提示词连成同一段前缀：同一本书每回合都一样，DeepSeek 等模型会按缓存价计费。
 */
const STABLE_KEYS = ["world", "background", "locations", "name_pool", "tags"];
function splitContext(context: unknown) {
  if (!context || typeof context !== "object") return { stable: {}, rest: context };
  const c = context as Record<string, unknown>;
  const stable: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) (STABLE_KEYS.includes(k) ? stable : rest)[k] = v;
  return { stable, rest };
}

export function recordMessages(p: {
  context: unknown;
  template: unknown;
  recent: RecentTurn[];
  playerInput: string;
  hint: string;
  twistCandidates?: unknown;
  replacesTurn?: number | null;
}) {
  const { stable, rest } = splitContext(p.context);
  const user = [
    "## 这本书的固定设定（运行时上下文的一部分）",
    j(stable),
    "## 运行时的当前上下文（其余部分）",
    j(rest),
    "## 这一回合的记录模板",
    j(p.template),
    ...(p.twistCandidates ? ["## 转折候选（玩家说了“来点转折”）", j(p.twistCandidates)] : []),
    "## 最近的正文",
    recentBlock(p.recent),
    "## 玩家这一句",
    p.playerInput ? p.playerInput : "（空输入）",
    p.hint ? `（${p.hint}）` : "",
    "## 本次任务",
    [
      "先判断这一句的 action_mode，再照模板写这一回合的记录（commit-turn 的 turns 里的一项）。",
      "这一步只做记录，正文下一步再写：operations 写这一回合会发生的事（NPC 的回应与行动、新事实、关系、时间推进、进出场等），summary 与 open_action 描述这一回合将停在哪里。",
      "上一回合正文里新写出、以后要用到的细节，以及新点名的人，在这次记录里补上（add_fact、introduce_character）。",
      p.replacesTurn ? `玩家说“刚才不算”：这一项写 "replaces_turn": ${p.replacesTurn}，按玩家的新说法重新判定。` : "",
      "只输出这一项的 JSON 对象本身（不要外层的 session_id、request_id、turns），不要任何解释或正文。",
    ]
      .filter(Boolean)
      .join("\n"),
  ].join("\n\n");
  return [
    { role: "system" as const, content: systemPrompt("record") },
    { role: "user" as const, content: user },
  ];
}

export function fixMessages(
  original: ReturnType<typeof recordMessages>,
  draft: string,
  error: unknown,
) {
  return [
    ...original,
    { role: "assistant" as const, content: draft },
    {
      role: "user" as const,
      content: `运行时拒绝了这条记录：\n${j(error)}\n\n按 details 里的 path 和 hint 改好，只输出改好后的这一项 JSON。`,
    },
  ];
}

export function writeMessages(p: {
  context: unknown;
  committed: unknown;
  results: unknown;
  recent: RecentTurn[];
  playerInput: string;
  length: TurnLength;
}) {
  const words = LENGTHS[p.length].words;
  const user = [
    "## 运行时记录后的上下文",
    j(p.context),
    "## 这一回合已记录的内容",
    j(p.committed),
    "## 运行时的结果（applied、到期事件、掷骰、离屏推演）",
    j(p.results),
    "## 最近的正文",
    recentBlock(p.recent),
    "## 玩家这一句",
    p.playerInput || "（空输入）",
    "## 本次任务",
    [
      "按已记录的内容和运行时的结果，写这一回合的正文。掷骰、到期、离屏移动与传播以运行时为准，不要写出记录里没有的重大变化。",
      `篇幅：这一回合正文写 ${words}（以这里为准，不按原文的“约 300–700 字”）。字数靠把这一回合里发生的事写足：动作、对话的来回、环境、人物的反应与细节，不靠注水、不重复、不提前写到下一回合，也不替玩家做决定。`,
      "正文直接从上一回合结尾那一刻接上，不加标题，不复述上一回合。结尾停在 open_action 描述的未决动作上，不替玩家接。",
      "玩家角色的台词只用玩家说过的意思。叙事助手开启时，末尾加“可以：① …… ② …… ③ ……”。",
      "不要写页脚（时间、地点、回合号），程序会加上。",
    ].join("\n"),
  ].join("\n\n");
  return [
    { role: "system" as const, content: systemPrompt("write") },
    { role: "user" as const, content: user },
  ];
}

export function openingMessages(p: { opening: unknown; context: unknown; length?: TurnLength }) {
  const words = p.length && p.length !== "short" ? LENGTHS[p.length].words : "约 300–700 字";
  const user = [
    "## 运行时返回的开局（opening）",
    j(p.opening),
    "## 运行时的当前上下文",
    j(p.context),
    "## 本次任务",
    `按 Skill 原文“开局”第 5 步的格式写开局：先“世界观：”“人物：”两行，空一行，再写正文（不加标题，${words}；压力模式写出眼前的压力与近期期限，远期只作伏笔；结尾停在 hook 描述的未决动作上，不替玩家接）。不要写 footer 和 tip，程序会加上。`,
  ].join("\n\n");
  return [
    { role: "system" as const, content: systemPrompt("write") },
    { role: "user" as const, content: user },
  ];
}
