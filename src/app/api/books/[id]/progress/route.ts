import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ chapterId: z.string() });

type Ctx = { params: Promise<{ id: string }> };

/** 记录阅读进度，书架上的“继续阅读”和“读到第几章”用它 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { chapterId } = Body.parse(await req.json());
  await prisma.book.updateMany({
    where: { id, userId: user.id, chapters: { some: { id: chapterId } } },
    data: { lastReadChapterId: chapterId, lastReadAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
