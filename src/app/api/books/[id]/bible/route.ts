import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { BibleSchema, effectiveBible, mergeHidden, parseBible } from "@/lib/bible";

type Ctx = { params: Promise<{ id: string }> };

/** 作者手动修改设定集：改的是当前阅读位置的设定，之后的章节会按新设定写 */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const bible = BibleSchema.parse((await req.json()).bible);
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  const head = book.headChapterId
    ? await prisma.chapter.findUnique({ where: { id: book.headChapterId } })
    : null;
  const previous = parseBible(effectiveBible(book.bible, head?.bible));
  const json = JSON.stringify(mergeHidden(bible, previous));
  if (book.headChapterId) {
    await prisma.chapter.update({ where: { id: book.headChapterId }, data: { bible: json } });
  } else {
    await prisma.book.update({ where: { id }, data: { bible: json } });
  }
  return NextResponse.json({ ok: true });
});
