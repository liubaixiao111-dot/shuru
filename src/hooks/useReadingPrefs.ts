"use client";

import { useEffect, useState } from "react";

export type ReadingTheme = "paper" | "white" | "green" | "night";

export interface ReadingPrefs {
  fontSize: number;
  lineHeight: number;
  theme: ReadingTheme;
  font: "serif" | "sans";
}

export const DEFAULT_PREFS: ReadingPrefs = { fontSize: 19, lineHeight: 2, theme: "paper", font: "serif" };

export const THEMES: Record<ReadingTheme, { name: string; bg: string; fg: string; muted: string; card: string }> = {
  paper: { name: "纸张", bg: "#f7f3ea", fg: "#2b2622", muted: "rgba(43,38,34,.45)", card: "rgba(255,255,255,.7)" },
  white: { name: "白色", bg: "#ffffff", fg: "#1f1f1f", muted: "rgba(0,0,0,.4)", card: "#f5f5f5" },
  green: { name: "护眼", bg: "#dcebd5", fg: "#23331f", muted: "rgba(35,51,31,.45)", card: "rgba(255,255,255,.55)" },
  night: { name: "夜间", bg: "#141414", fg: "#b9b4ab", muted: "rgba(185,180,171,.45)", card: "#1f1f1f" },
};

const KEY = "shuru.readingPrefs";

/** 阅读偏好只跟着这台设备走，存在浏览器里 */
export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      // 隐私模式等情况下读不到，用默认值
    }
  }, []);

  function update(patch: Partial<ReadingPrefs>) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // 忽略
      }
      return next;
    });
  }

  return [prefs, update] as const;
}
