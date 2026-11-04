import { z } from "zod";

/**
 * 关系三条线：
 * - trust 信任 -5..5：信不信对方的话，愿不愿意为对方冒险
 * - stage 亲近进程：已经一起走到过的阶段（陌生、熟络、暧昧……），是历史，不是许可
 * - tension 张力 0..5：没说出口的吸引、敌意、竞争或秘密带来的紧绷，张力高不等于亲近
 */
export const RelationSchema = z.object({
  trust: z.number().int().min(-5).max(5).catch(0),
  stage: z.string().catch("陌生"),
  tension: z.number().int().min(0).max(5).catch(0),
  // 最近一次变化的原因
  why: z.string().catch(""),
});
export type Relation = z.infer<typeof RelationSchema>;

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
        // 此刻是否和主角在同一个场景里
        present: z.boolean().optional(),
        // 这个人对主角的关系（有向）。数值只给 AI 和程序用，界面上转成人话
        relation: RelationSchema.optional(),
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

export interface PublicCharacter {
  name: string;
  desc: string;
  present?: boolean;
  /** 关系的人话描述，不露数值 */
  bond?: string;
}
export type PublicBible = Omit<Bible, "characters"> & { characters: PublicCharacter[] };

/** 给阅读界面用的设定集：去掉人物的目的和秘密，关系转成人话，避免剧透和露数值 */
export function publicBible(b: Bible): PublicBible {
  return {
    ...b,
    characters: b.characters.map(({ name, desc, present, relation }) => ({
      name,
      desc,
      ...(present !== undefined ? { present } : {}),
      ...(relation ? { bond: relationWords(relation) } : {}),
    })),
  };
}

/** 把关系三条线写成一句人话 */
export function relationWords(r: Relation): string {
  const trust =
    r.trust <= -4 ? "完全不信你" : r.trust <= -2 ? "提防你" : r.trust <= -1 ? "对你有些疑虑" : r.trust === 0 ? "还在观察你" : r.trust <= 2 ? "愿意听你说" : r.trust <= 4 ? "信得过你" : "可以把命交给你";
  const tension = r.tension >= 4 ? "，你们之间绷得很紧" : r.tension >= 2 ? "，有些说不清的紧绷" : "";
  const stage = r.stage && r.stage !== "陌生" ? `${r.stage}，` : "";
  return `${stage}${trust}${tension}`;
}

/**
 * 关系慢热的硬限制（对应“每次变化都要说得出原因，一段之内不能突变”）：
 * - 每段信任最多变 2；张力最多变 2
 * - 追溯（“其实……”）不能给人物追加好感、信任或亲近
 * - 没有原因的变化不算数
 */
export function limitRelationChanges(prev: Bible, next: Bible, opts: { frozen: boolean }): Bible {
  const before = new Map(prev.characters.map((c) => [c.name, c.relation]));
  return {
    ...next,
    characters: next.characters.map((c) => {
      const old = before.get(c.name);
      if (!c.relation) return old ? { ...c, relation: old } : c;
      const base = old ?? { trust: 0, stage: "陌生", tension: 0, why: "" };
      const changed =
        c.relation.trust !== base.trust || c.relation.tension !== base.tension || c.relation.stage !== base.stage;
      if (!changed) return { ...c, relation: { ...c.relation, why: base.why || c.relation.why } };
      if (opts.frozen || !c.relation.why.trim()) return { ...c, relation: base };
      const clamp = (v: number, from: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, Math.max(from - 2, Math.min(from + 2, v))));
      return {
        ...c,
        relation: {
          trust: clamp(c.relation.trust, base.trust, -5, 5),
          tension: clamp(c.relation.tension, base.tension, 0, 5),
          stage: c.relation.stage || base.stage,
          why: c.relation.why,
        },
      };
    }),
  };
}

/** 作者保存设定集时，把界面上看不到的目的和秘密按人物名合并回来 */
export function mergeHidden(edited: Bible, previous: Bible): Bible {
  const byName = new Map(previous.characters.map((c) => [c.name, c]));
  return {
    ...edited,
    state: previous.state,
    characters: edited.characters.map((c) => {
      const old = byName.get(c.name);
      return {
        ...c,
        goal: c.goal ?? old?.goal,
        secret: c.secret ?? old?.secret,
        present: c.present ?? old?.present,
        relation: c.relation ?? old?.relation,
      };
    }),
  };
}
