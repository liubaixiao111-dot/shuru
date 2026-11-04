import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  nickname: z.string().trim().min(1, "请填写昵称").max(20, "昵称最多 20 字"),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const email = body.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "这个邮箱已经注册过了");
  const user = await prisma.user.create({
    data: { email, nickname: body.nickname, passwordHash: await hashPassword(body.password) },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
