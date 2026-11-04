import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, HttpError, verifyPassword } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ email: z.string().email("邮箱格式不正确"), password: z.string().min(1, "请输入密码") });

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new HttpError(401, "邮箱或密码不对");
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
