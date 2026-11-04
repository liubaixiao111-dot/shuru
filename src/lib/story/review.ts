import { z } from "zod";
import type { Bible } from "../bible";

/**
 * 写后审校：章节写完后，由模型对照设定集和前情检查一遍“不合理”的地方，
 * 有实质问题就带着问题清单重写一次。最多修正一次，避免成本和等待时间失控。
 */

export const REVIEW_CHECKLIST = [
  "与设定集或前情矛盾：人物生死、身份、能力、彼此关系、已发生的事、时间和地点对不上。",
  "人物知道了不该知道的信息，或者没有理由地主动说破自己的秘密。",
  "配角没有理由地放下戒心、放弃自己的目的、突然倒戈，或对主角产生好感、信任。",
  "主角凭空获得能力、物品、情报或运气。",
  "作者的想法没有兑现：主角自己的动作被写成落空或被偷换；或者作用于别人的想法被直接写成了对方无条件照办。",
  "因果断裂：事件缺少起因，转折突兀，或者时间跨度不合理。",
  "出现露骨的性描写，或涉及未成年人的不当内容。",
];

export interface ReviewInput {
  bible: Bible;
  /** 前情摘要（按顺序） */
  recap: string[];
  idea: string | null;
  chapter: string;
}

export function buildReviewMessages(r: ReviewInput) {
  const system = [
    "你是一位严格的小说审校，只检查情节和设定上的硬伤，不评价文笔，不提风格建议。",
    "逐条对照以下清单检查本章：",
    ...REVIEW_CHECKLIST.map((c, i) => `${i + 1}. ${c}`),
    "",
    "只报告读者读到会觉得“这不对”的实质问题；可以靠后文自然解释的伏笔、悬念，不算问题。",
    '只输出一个 JSON 对象：没有问题时 {"ok": true}；有问题时 {"ok": false, "issues": ["问题1：哪里不对，应该怎么改", "..."]}，最多 5 条。',
  ].join("\n");

  const user = [
    `设定集（含人物的目的与秘密）：\n${JSON.stringify(r.bible, null, 2)}`,
    r.recap.length ? `前情摘要：\n${r.recap.join("\n")}` : "前情：这是第一章。",
    r.idea ? `作者对本章的想法：${r.idea}` : "作者对本章没有特别要求。",
    `待审章节：\n${r.chapter}`,
  ].join("\n\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

const ReviewSchema = z.object({ ok: z.boolean(), issues: z.array(z.string()).default([]) });

export type ReviewResult = { ok: true } | { ok: false; issues: string[] };

/** 解析审校结果。解析失败时视为通过，不阻塞写作。 */
export function parseReview(raw: string): ReviewResult {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { ok: true };
  try {
    const r = ReviewSchema.parse(JSON.parse(m[0]));
    const issues = r.issues.map((s) => s.trim()).filter(Boolean).slice(0, 5);
    return r.ok || issues.length === 0 ? { ok: true } : { ok: false, issues };
  } catch {
    return { ok: true };
  }
}

/** 带着问题清单让写作模型重写本章 */
export function buildFixMessages(
  original: { role: "system" | "user"; content: string }[],
  draft: string,
  issues: string[],
) {
  return [
    ...original,
    { role: "assistant" as const, content: draft },
    {
      role: "user" as const,
      content: [
        "审校发现这一章有以下问题：",
        ...issues.map((s, i) => `${i + 1}. ${s}`),
        "",
        "请修正这些问题，输出修正后的完整章节。尽量保留原来写得好的场面和对话，只改有问题的地方。输出格式和之前完全一样（标题、空行、正文、META）。",
      ].join("\n"),
    },
  ];
}
