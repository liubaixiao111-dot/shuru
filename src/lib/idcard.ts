/**
 * 18 位居民身份证号的格式与校验位检查，并算出年龄。
 * 注意：这只是本地校验，不能证明“身份证是本人的”。正式上线需接入第三方实名核验服务
 * （姓名 + 身份证号 + 人脸），见 README 的“上线前待办”。
 */
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK = "10X98765432";

export function parseIdCard(id: string, now = new Date()): { ok: true; age: number } | { ok: false } {
  const v = id.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(v)) return { ok: false };
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(v[i]), 0);
  if (CHECK[sum % 11] !== v[17]) return { ok: false };
  const y = Number(v.slice(6, 10));
  const m = Number(v.slice(10, 12));
  const d = Number(v.slice(12, 14));
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d || birth > now) {
    return { ok: false };
  }
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
  return { ok: true, age };
}
