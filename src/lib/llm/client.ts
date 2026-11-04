import OpenAI from "openai";
import { prisma } from "../db";
import { decrypt } from "../crypto";
import { HttpError } from "../auth";
import { PLATFORM_CHAIN, PROVIDERS, type ProviderId } from "./providers";

/** 本地联调用：把所有模型请求指向一个 OpenAI 兼容的模拟服务 */
function baseURLFor(provider: ProviderId) {
  return process.env.LLM_BASE_URL_OVERRIDE || PROVIDERS[provider].baseURL;
}

export interface ResolvedModel {
  mode: "platform" | "byok";
  provider: ProviderId;
  model: string;
  client: OpenAI;
}

/**
 * 选择本次调用使用的模型：
 * 1. 用户配置了默认的自带 Key → 用它，不扣平台额度；
 * 2. 否则走平台模式，按 PLATFORM_CHAIN 顺序找到可用的密钥，并检查剩余额度。
 * 返回列表以便调用失败时切到下一个备用模型。
 */
export { baseURLFor };

export async function resolveModels(userId: string): Promise<ResolvedModel[]> {
  const byok = await prisma.apiKey.findFirst({ where: { userId, isDefault: true } });
  if (byok) {
    const info = PROVIDERS[byok.provider as ProviderId];
    if (!info) throw new HttpError(400, "自带 Key 的模型厂商不受支持，请在设置里重新配置");
    return [
      {
        mode: "byok",
        provider: info.id,
        model: byok.model || info.defaultModel,
        client: new OpenAI({ apiKey: decrypt(byok.encryptedKey), baseURL: baseURLFor(info.id) }),
      },
    ];
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.platformTokens <= 0) {
    throw new HttpError(402, "试用额度已用完，可以在设置里填入自己的模型 API Key 继续写");
  }
  const chain = PLATFORM_CHAIN.flatMap(({ provider, envKey }) => {
    const apiKey = process.env[envKey];
    if (!apiKey) return [];
    const info = PROVIDERS[provider];
    return [
      {
        mode: "platform" as const,
        provider,
        model: info.defaultModel,
        client: new OpenAI({ apiKey, baseURL: baseURLFor(provider) }),
      },
    ];
  });
  if (chain.length === 0) throw new HttpError(503, "平台模型暂未配置，请在设置里填入自己的 API Key");
  return chain;
}

export async function recordUsage(args: {
  userId: string;
  bookId?: string;
  m: ResolvedModel;
  promptTokens: number;
  completionTokens: number;
}) {
  const { userId, bookId, m, promptTokens, completionTokens } = args;
  await prisma.usageLog.create({
    data: {
      userId,
      bookId,
      mode: m.mode,
      provider: m.provider,
      model: m.model,
      promptTokens,
      completionTokens,
    },
  });
  if (m.mode === "platform") {
    await prisma.user.update({
      where: { id: userId },
      data: { platformTokens: { decrement: promptTokens + completionTokens } },
    });
  }
}

/** 厂商不返回 usage 时的粗略估算：中文约 1 字 ≈ 1 token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.0);
}
