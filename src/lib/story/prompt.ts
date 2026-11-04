import type { Bible } from "../bible";

export const META_MARKER = "<<<META>>>";

export interface PromptInput {
  bookTitle: string;
  genre: string;
  bible: Bible;
  adult: boolean;
  /** 已发生章节的摘要（按顺序），最后两章另附全文 */
  history: { index: number; title: string; summary: string; content: string }[];
  idea: string | null;
  nextIndex: number;
  /** 收尾指令：null 表示正常连载 */
  ending: { left: number } | null;
}

const CONTENT_RULES_DEFAULT =
  "内容要求：适合全年龄阅读，可以有冲突与紧张感，但不出现血腥细节和亲密描写。";
const CONTENT_RULES_ADULT =
  "内容要求：作者已开启成人向，可以写暴力、黑暗、惊悚等成熟题材，以及含蓄的亲密关系，但绝不出现露骨的性描写，不涉及未成年人的任何性相关内容。";

const MAX_SUMMARIES = 60;

export function buildMessages(p: PromptInput) {
  const system = [
    "你是网文平台「书入」的小说作者，和读者一起写一部连载小说。读者是这本书的作者兼主角掌舵人，你负责把他们的想法写成好看的章节。",
    "写作要求：",
    "1. 每章 1500 到 2500 字，有具体场景、动作和对话，章末留一个让人想看下一章的钩子。",
    "2. 严格遵守设定集，人物性格、能力和已发生的事件不能前后矛盾。",
    "3. 读者的想法优先。如果想法和已有设定冲突，不要拒绝，而是写出一个合理的解释让它成立。",
    "4. 不要主动把故事往结局引导，也不要提示读者故事快结束了。只有收到明确的收尾指令时才收尾。",
    p.adult ? CONTENT_RULES_ADULT : CONTENT_RULES_DEFAULT,
    "",
    "输出格式（必须严格遵守）：",
    "第一行是本章标题，只写标题本身，不写“第几章”。",
    "第二行空行，之后是正文。",
    `正文结束后另起一行写 ${META_MARKER}，再输出一个 JSON 对象，字段如下：`,
    '{"summary": "本章 100 字以内的摘要", "suggestions": ["接下来可能的走向1", "走向2", "走向3"], "bible": 更新后的完整设定集（结构与输入相同，新增人物和重要事实要加进去）}',
    "suggestions 每条不超过 20 字，要有明显差异。",
  ].join("\n");

  const older = p.history.slice(0, -2).slice(-MAX_SUMMARIES);
  const recent = p.history.slice(-2);
  const parts: string[] = [];
  parts.push(`书名：《${p.bookTitle}》  题材：${p.genre}`);
  parts.push(`设定集：\n${JSON.stringify(p.bible, null, 2)}`);
  if (older.length) {
    parts.push("前情摘要：\n" + older.map((c) => `第${c.index}章 ${c.title}：${c.summary}`).join("\n"));
  }
  for (const c of recent) {
    parts.push(`第${c.index}章 ${c.title}（全文）：\n${c.content}`);
  }
  parts.push(`现在请写第${p.nextIndex}章。`);
  parts.push(p.idea ? `作者对这一章的想法：${p.idea}` : "作者没有特别要求，请你按故事的走向自然推进。");
  if (p.ending) {
    parts.push(
      p.ending.left <= 1
        ? "收尾指令：这是全书最后一章，请把主要线索收束，给出一个完整、有余味的结局。suggestions 返回空数组。"
        : `收尾指令：作者希望在接下来 ${p.ending.left} 章内完结，请开始逐步收束主线。`,
    );
  }
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: parts.join("\n\n") },
  ];
}
