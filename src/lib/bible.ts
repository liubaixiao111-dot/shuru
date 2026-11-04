import { z } from "zod";

/** 设定集：AI 每章自动维护，作者可以手动修改 */
export const BibleSchema = z.object({
  world: z.string().default(""),
  protagonist: z.string().default(""),
  characters: z.array(z.object({ name: z.string(), desc: z.string() })).default([]),
  style: z.string().default(""),
  facts: z.array(z.string()).default([]),
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
