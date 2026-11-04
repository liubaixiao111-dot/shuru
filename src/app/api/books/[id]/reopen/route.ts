import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** 完结后继续写番外或新卷 */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { count } = await prisma.book.updateMany({
    where: { id, userId: user.id, status: "finished" },
    data: { status: "ongoing", endingLeft: null },
  });
  if (!count) throw new HttpError(400, "这本书还没有完结");
  return NextResponse.json({ ok: true });
});
