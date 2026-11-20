/**
 * 已备案的国内模型，全部通过 OpenAI 兼容接口接入。
 * 默认模型名可能随厂商更新而变化，自带 Key 的用户可以在设置里改。
 */
export type ProviderId = "deepseek" | "qwen" | "doubao" | "kimi" | "zhipu";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  baseURL: string;
  defaultModel: string;
  /** 流式输出时是否支持返回 usage */
  streamUsage: boolean;
  keyHint: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    streamUsage: true,
    keyHint: "在 platform.deepseek.com 创建",
  },
  qwen: {
    id: "qwen",
    name: "通义千问",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    streamUsage: true,
    keyHint: "在阿里云百炼控制台创建",
  },
  doubao: {
    id: "doubao",
    name: "豆包",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6-250615",
    streamUsage: true,
    keyHint: "在火山方舟控制台创建，模型名可填推理接入点 ID",
  },
  kimi: {
    id: "kimi",
    name: "Kimi",
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-32k",
    streamUsage: false,
    keyHint: "在 platform.moonshot.cn 创建",
  },
  zhipu: {
    id: "zhipu",
    name: "智谱",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    streamUsage: false,
    keyHint: "在 bigmodel.cn 创建",
  },
};

export function isProviderId(v: string): v is ProviderId {
  return v in PROVIDERS;
}

/** 平台（积分）模式的模型顺序：DeepSeek 为主，通义千问备用 */
export const PLATFORM_CHAIN: { provider: ProviderId; envKey: string }[] = [
  { provider: "deepseek", envKey: "DEEPSEEK_API_KEY" },
  { provider: "qwen", envKey: "QWEN_API_KEY" },
];
