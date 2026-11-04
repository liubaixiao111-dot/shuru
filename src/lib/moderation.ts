/**
 * 内容审核占位实现。
 * 上线前需接入正式的内容安全服务（如阿里云内容安全、网易易盾），并对模型输出做二次审核。
 * 这里只做最基础的输入拦截，避免明显违规的请求进入模型。
 */
const BLOCKED: RegExp[] = [/未成年.{0,6}(性|裸)/, /(幼女|萝莉).{0,6}(性|裸)/];

export function checkInput(text: string): { ok: true } | { ok: false; reason: string } {
  for (const re of BLOCKED) {
    if (re.test(text)) return { ok: false, reason: "这个想法包含不被允许的内容，请换个方向" };
  }
  return { ok: true };
}
