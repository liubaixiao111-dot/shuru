/** 按题材给书生成渐变封面，不需要图片资源 */
const PALETTE: Record<string, [string, string]> = {
  古代悬疑: ["#3a1c1c", "#a3472f"],
  谍战: ["#1c2a2a", "#4f6d5b"],
  现代悬疑: ["#111827", "#475569"],
  仙侠: ["#1e1b4b", "#7c8fd6"],
  民国言情: ["#3b1d2b", "#c26a7a"],
  科幻惊悚: ["#05212b", "#1fa5b8"],
  都市惊悚: ["#1a1a2e", "#6b4fa0"],
  宫廷权谋: ["#3d1508", "#c58b2c"],
  我的人生: ["#2a2a1e", "#d6b46a"],
};

const FALLBACK: [string, string][] = [
  ["#2b2140", "#e0739a"],
  ["#14322f", "#5fbf9c"],
  ["#3a2a12", "#e2a04a"],
  ["#1d2a44", "#6d9be0"],
];

export function coverGradient(genre: string, seed = ""): string {
  const pair =
    PALETTE[genre] ?? FALLBACK[[...(genre + seed)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % FALLBACK.length];
  return `linear-gradient(150deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
}
