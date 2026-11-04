import { z } from "zod";

/** 设定集：AI 每章自动维护，作者可以手动修改 */
export const BibleSchema = z.object({
  world: z.string().default(""),
  protagonist: z.string().default(""),
  characters: z
    .array(
      z.object({
        name: z.string(),
        desc: z.string(),
        // 人物自己想要什么。NPC 按自己的目的行动，不围着主角转
        goal: z.string().optional(),
        // 主角暂时不知道的事。只给 AI 看，阅读界面不展示，避免剧透
        secret: z.string().optional(),
      }),
    )
    .default([]),
  style: z.string().default(""),
  facts: z.array(z.string()).default([]),
  // 故事状态：当前时间地点，以及悬而未决的线索/压力
  state: z
    .object({
      time: z.string().default(""),
      place: z.string().default(""),
      threads: z.array(z.string()).default([]),
    })
    .default({}),
});

export type Bible = z.infer<typeof BibleSchema>;

export function parseBible(raw: string): Bible {
  try {
    return BibleSchema.parse(JSON.parse(raw));
  } catch {
    return BibleSchema.parse({});
  }
}

/** 某一章之后的设定集：优先用该章的快照，没有则用开书设定 */
export function effectiveBible(bookBible: string, chapterBible: string | null | undefined): string {
  return chapterBible ?? bookBible;
}

/** 给阅读界面用的设定集：去掉人物的目的和秘密，避免剧透 */
export function publicBible(b: Bible): Bible {
  return { ...b, characters: b.characters.map(({ name, desc }) => ({ name, desc })) };
}

/** 作者保存设定集时，把界面上看不到的目的和秘密按人物名合并回来 */
export function mergeHidden(edited: Bible, previous: Bible): Bible {
  const byName = new Map(previous.characters.map((c) => [c.name, c]));
  return {
    ...edited,
    state: previous.state,
    characters: edited.characters.map((c) => {
      const old = byName.get(c.name);
      return { ...c, goal: c.goal ?? old?.goal, secret: c.secret ?? old?.secret };
    }),
  };
}
