import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { latestLeaf } from "@/lib/tree";

const Body = z.object({
  chapterId: z.string(),
  /** true：沿这一章一直走到该分支最新的一章；false：停在这一章（回到分叉点） */
  followLatest: z.boolean().default(true),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  const chapters = await prisma.chapter.findMany({ where: { bookId: id } });
  if (!chapters.some((c) => c.id === body.chapterId)) throw new HttpError(400, "章节不存在");
  const head = body.followLatest ? latestLeaf(chapters, body.chapterId) : body.chapterId;
  await prisma.book.update({ where: { id }, data: { headChapterId: head } });
  return NextResponse.json({ ok: true });
});
