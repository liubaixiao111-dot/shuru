import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { parseIdCard } from "@/lib/idcard";

const Body = z.object({
  realName: z.string().trim().min(2, "请填写真实姓名").max(20),
  idNumber: z.string().trim(),
});

/** 年龄验证（占位）：只校验身份证格式并计算年龄，不保存姓名和证件号 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = Body.parse(await req.json());
  const r = parseIdCard(body.idNumber);
  if (!r.ok) throw new HttpError(400, "身份证号格式不正确");
  if (r.age < 18) throw new HttpError(403, "未满 18 岁，暂时不能开启成人向内容");
  // TODO: 接入第三方实名核验（姓名 + 证件号一致性）
  await prisma.user.update({ where: { id: user.id }, data: { ageVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
