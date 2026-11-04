import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ mode: z.enum(["now", "gradual", "cancel"]) });

type Ctx = { params: Promise<{ id: string }> };

/** 完结完全由作者发起：now = 下一章就是结局；gradual = 用 3 章慢慢收尾；cancel = 取消收尾 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { mode } = Body.parse(await req.json());
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  if (book.status === "finished") throw new HttpError(400, "这本书已经完结了");
  await prisma.book.update({
    where: { id },
    data:
      mode === "cancel"
        ? { status: "ongoing", endingLeft: null }
        : { status: "ending", endingLeft: mode === "now" ? 1 : 3 },
  });
  return NextResponse.json({ ok: true });
});
