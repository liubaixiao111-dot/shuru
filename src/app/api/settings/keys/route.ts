import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { encrypt } from "@/lib/crypto";
import { isProviderId, PROVIDERS } from "@/lib/llm/providers";
import { baseURLFor } from "@/lib/llm/client";

const Save = z.object({
  provider: z.string().refine(isProviderId, "不支持的模型厂商"),
  model: z.string().trim().max(80).default(""),
  key: z.string().trim().min(8, "API Key 看起来不完整"),
});

/** 保存自带 Key：先用一次极短的请求验证 Key 可用，再加密保存并设为默认 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = Save.parse(await req.json());
  const info = PROVIDERS[body.provider as keyof typeof PROVIDERS];
  const model = body.model || info.defaultModel;
  try {
    const client = new OpenAI({ apiKey: body.key, baseURL: baseURLFor(info.id) });
    await client.chat.completions.create({ model, messages: [{ role: "user", content: "你好" }], max_tokens: 1 });
  } catch (e) {
    console.error("[keys] 验证失败", e);
    throw new HttpError(400, `${info.name} 的 Key 或模型名验证没通过，请检查后再试`);
  }
  await prisma.$transaction([
    prisma.apiKey.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.apiKey.upsert({
      where: { userId_provider: { userId: user.id, provider: info.id } },
      create: { userId: user.id, provider: info.id, model, encryptedKey: encrypt(body.key), isDefault: true },
      update: { model, encryptedKey: encrypt(body.key), isDefault: true },
    }),
  ]);
  return NextResponse.json({ ok: true });
});

const Patch = z.object({ provider: z.string().nullable() });

/** 切换默认：provider 为 null 表示改用平台额度 */
export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const { provider } = Patch.parse(await req.json());
  await prisma.apiKey.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  if (provider) {
    const { count } = await prisma.apiKey.updateMany({
      where: { userId: user.id, provider },
      data: { isDefault: true },
    });
    if (!count) throw new HttpError(404, "还没有保存这个厂商的 Key");
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const provider = new URL(req.url).searchParams.get("provider") ?? "";
  await prisma.apiKey.deleteMany({ where: { userId: user.id, provider } });
  return NextResponse.json({ ok: true });
});
