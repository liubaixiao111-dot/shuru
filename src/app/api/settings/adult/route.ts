import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ enabled: z.boolean() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { enabled } = Body.parse(await req.json());
  if (enabled && !user.ageVerifiedAt) throw new HttpError(403, "请先完成年龄验证");
  await prisma.user.update({ where: { id: user.id }, data: { adultEnabled: enabled } });
  return NextResponse.json({ ok: true });
});
