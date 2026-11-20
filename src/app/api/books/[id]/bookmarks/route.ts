import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ chapterId: z.string() });

type Ctx = { params: Promise<{ id: string }> };

async function ownBook(userId: string, id: string) {
  const book = await prisma.book.findFirst({ where: { id, userId } });
  if (!book) throw new HttpError(404, "找不到这本书");
  return book;
}

/** 给某一章加书签 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await ownBook(user.id, id);
  const { chapterId } = Body.parse(await req.json());
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, bookId: id } });
  if (!chapter) throw new HttpError(404, "章节不存在");
  await prisma.bookmark.upsert({
    where: { bookId_chapterId: { bookId: id, chapterId } },
    create: { bookId: id, chapterId, excerpt: chapter.content.replace(/\s+/g, "").slice(0, 40) },
    update: {},
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await ownBook(user.id, id);
  const chapterId = new URL(req.url).searchParams.get("chapterId") ?? "";
  await prisma.bookmark.deleteMany({ where: { bookId: id, chapterId } });
  return NextResponse.json({ ok: true });
});
