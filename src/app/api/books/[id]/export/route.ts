import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { pathTo } from "@/lib/tree";

type Ctx = { params: Promise<{ id: string }> };

/** 导出当前分支为 TXT */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  const chapters = pathTo(await prisma.chapter.findMany({ where: { bookId: id } }), book.headChapterId);
  const text = [
    `《${book.title}》`,
    "本书内容由 AI 根据作者的想法生成",
    ...chapters.map((c) => `第${c.index}章 ${c.title}\n\n${c.content}`),
  ].join("\n\n\n");
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(book.title)}.txt`,
    },
  });
});
