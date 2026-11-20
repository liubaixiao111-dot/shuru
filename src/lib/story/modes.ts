/**
 * 作者这一段的输入方式。参照互动叙事里“玩家主权”的分档：
 * - action  作者写了行动、对白或意图。主角自己的事直接发生；作用于别人的事只写尝试，结果由对方决定
 * - continue 没有新行动，让场景自然往前走，主角不做重大决定
 * - wait    主角明确选择不动，把空间留给别人
 * - retcon  “其实……”：补一条过去就成立的事实
 * - rewrite “刚才不算，改成……”：撤掉上一段，按新的想法重写
 * - skip    快进到某个时间
 * - twist   来点转折
 */
export const MODES = ["action", "continue", "wait", "retcon", "rewrite", "skip", "twist"] as const;
export type Mode = (typeof MODES)[number];

export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

/** 根据作者的话判断输入方式；界面上点了按钮时以按钮为准 */
export function detectMode(idea: string | null, explicit?: Mode | null): { mode: Mode; idea: string | null } {
  const text = idea?.trim() || null;
  if (explicit) return { mode: explicit, idea: text };
  if (!text || /^(继续|……+|\.{3,}|你决定|随便)$/.test(text)) return { mode: "continue", idea: null };
  const rewrite = text.match(/^(刚才|上一段|上面)(的)?不算[，,。：:\s]*(改成|换成)?[：:\s]*/);
  if (rewrite) return { mode: "rewrite", idea: text.slice(rewrite[0].length).trim() || null };
  if (/^其实/.test(text)) return { mode: "retcon", idea: text };
  if (/^快进/.test(text)) return { mode: "skip", idea: text };
  if (/^来点?(个)?转折/.test(text)) return { mode: "twist", idea: text.replace(/^来点?(个)?转折[，,。：:\s]*/, "") || null };
  if (/^(我)?(先)?(不说话|不吭声|不动|沉默|等着|等等|等一等|看(看)?(他|她|它|他们|她们)(要)?怎么)/.test(text))
    return { mode: "wait", idea: text };
  return { mode: "action", idea: text };
}
