import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { count } = await prisma.book.deleteMany({ where: { id, userId: user.id } });
  if (!count) throw new HttpError(404, "找不到这本书");
  return NextResponse.json({ ok: true });
});
