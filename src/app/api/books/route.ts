import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { checkInput } from "@/lib/moderation";
import { fillName, getScene } from "@/lib/scenes";
import type { Bible } from "@/lib/bible";
import { createAtGame } from "@/lib/at/host";

const Body = z.object({
  title: z.string().trim().min(1, "请填写书名").max(30, "书名最多 30 字"),
  protagonistName: z.string().trim().max(10, "主角名最多 10 字").optional(),
  adult: z.boolean().default(false),
  sceneId: z.string().optional(),
  // 日常：没有倒计时和外部压力；压力：有事件、有期限。不传则按场景默认
  tone: z.enum(["pressure", "daily"]).optional(),
  // 原创开局
  original: z
    .object({
      genre: z.string().trim().min(1, "请选择题材").max(10),
      premise: z.string().trim().min(5, "一句话设定至少 5 个字").max(500, "设定最多 500 字"),
      world: z.string().max(1000).default(""),
      protagonist: z.string().max(500).default(""),
    })
    .optional(),
  // “我的人生”场景的问答
  answers: z.record(z.string().max(300)).optional(),
  // 叙事引擎开局
  at: z
    .object({
      mode: z.enum(["daily", "pressure", "random"]),
      worldId: z.string().max(40).optional(),
      worldQuery: z.string().max(40).optional(),
      playerName: z.string().trim().max(12).optional(),
      playerGender: z.enum(["male", "female"]).optional(),
      npcGender: z.enum(["any", "mostly_female", "mostly_male", "female_only", "male_only", "mixed"]).optional(),
    })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = Body.parse(await req.json());
  if (body.adult && !user.adultEnabled) throw new HttpError(403, "请先在设置里完成年龄验证并开启成人向");

  for (const text of [body.original?.premise, body.original?.world, ...Object.values(body.answers ?? {})]) {
    if (!text) continue;
    const r = checkInput(text);
    if (!r.ok) throw new HttpError(400, r.reason);
  }

  if (body.at) {
    const a = body.at;
    const game = await createAtGame({
      mode: a.mode,
      ...(a.worldId ? { locks: { world_id: a.worldId } } : a.worldQuery ? { world_query: a.worldQuery } : {}),
      player: { ...(a.playerName ? { name: a.playerName } : {}), ...(a.playerGender ? { gender: a.playerGender } : {}) },
      ...(a.npcGender ? { npc_gender_preference: a.npcGender } : {}),
      // 成人向关闭时尺度用“含蓄”；开启时按引擎默认
      preferences: body.adult ? {} : { explicitness: "subtle" },
    });
    const book = await prisma.book.create({
      data: {
        userId: user.id,
        title: body.title === "auto" ? game.opening.world.title : body.title,
        genre: (game.opening as { mode?: string }).mode === "daily" ? "日常" : "压力",
        bible: "{}",
        adult: body.adult,
        engine: "at",
        atSession: game.session_id,
        atRevision: game.revision,
        atNextReq: game.next_request_id,
        atOpening: JSON.stringify(game.opening),
      },
    });
    return NextResponse.json({ id: book.id, needsFirstChapter: true });
  }

  if (body.sceneId) {
    const scene = getScene(body.sceneId);
    if (!scene) throw new HttpError(400, "场景不存在");
    const name = body.protagonistName || scene.protagonistName;
    const bible = fillName(scene.bible, name);
    if (scene.questions && body.answers) {
      bible.facts = scene.questions
        .filter((q) => body.answers?.[q.key]?.trim())
        .map((q) => `${q.label}：${body.answers![q.key].trim()}`);
    }
    const book = await prisma.book.create({
      data: {
        userId: user.id,
        title: body.title,
        sceneId: scene.id,
        genre: scene.genre,
        bible: JSON.stringify(bible),
        adult: body.adult,
        prefs: JSON.stringify({ tone: body.tone ?? (scene.id === "my-life" ? "daily" : "pressure") }),
      },
    });
    if (scene.opening) {
      const opening = fillName(scene.opening, name);
      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          index: 1,
          title: opening.title,
          content: opening.content,
          summary: opening.content.slice(0, 100),
          suggestions: JSON.stringify(opening.suggestions),
          bible: JSON.stringify(bible),
        },
      });
      await prisma.book.update({ where: { id: book.id }, data: { headChapterId: chapter.id } });
    }
    return NextResponse.json({ id: book.id, needsFirstChapter: !scene.opening });
  }

  if (!body.original) throw new HttpError(400, "请选择一个场景，或者填写原创设定");
  const bible: Bible = {
    world: body.original.world,
    protagonist: [body.protagonistName, body.original.protagonist].filter(Boolean).join("，"),
    characters: [],
    style: "",
    facts: [`故事设定：${body.original.premise}`],
    state: { time: "", place: "", threads: [] },
  };
  const book = await prisma.book.create({
    data: {
      userId: user.id,
      title: body.title,
      genre: body.original.genre,
      bible: JSON.stringify(bible),
      adult: body.adult,
      prefs: JSON.stringify({ tone: body.tone ?? "pressure" }),
    },
  });
  return NextResponse.json({ id: book.id, needsFirstChapter: true });
});
