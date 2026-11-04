import { z } from "zod";

/**
 * 每本书的叙事偏好。只影响写法和节奏，不改变规则：
 * 人物的意志、关系慢热、底线和作者设下的边界都照旧。
 */
export const StoryPrefsSchema = z.object({
  /** 节奏：慢热多铺垫；标准；直接尽快把冲突和选择摆到主角面前 */
  pace: z.enum(["slow", "standard", "direct"]).catch("standard"),
  /** 人称：第三人称用主角名字；第二人称用“你” */
  person: z.enum(["third", "second"]).catch("third"),
  /** 日常：没有倒计时和外部压力，张力来自人物本身；压力：有事件、有期限 */
  tone: z.enum(["pressure", "daily"]).catch("pressure"),
  /** 内心可见：正文可以写配角没说出口的念头，但主角并不知道 */
  innerView: z.boolean().catch(false),
  /** 叙事助手：每段末尾直接显示 2–3 个可选行动；关闭时收在“没灵感？”里 */
  assistant: z.boolean().catch(false),
  /** 离屏推演：不在场的人也在按自己的目的行动；关闭则冻结 */
  offscreen: z.boolean().catch(true),
  /** 作者登记的硬边界：“不要 X”，任何时候都不写 */
  boundaries: z.array(z.string().max(60)).max(20).catch([]),
  /** 作者按了暂停：下一段不延续被暂停的场面 */
  paused: z.boolean().catch(false),
});

export type StoryPrefs = z.infer<typeof StoryPrefsSchema>;

export function parsePrefs(raw: string | null | undefined): StoryPrefs {
  try {
    return StoryPrefsSchema.parse(JSON.parse(raw || "{}"));
  } catch {
    return StoryPrefsSchema.parse({});
  }
}

/** 部分更新，未知字段丢弃 */
export const StoryPrefsPatch = StoryPrefsSchema.partial().strict();
