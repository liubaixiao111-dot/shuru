import { describe, expect, it } from "vitest";
import { parseIdCard } from "@/lib/idcard";

// 用国标算法生成校验位，避免在代码里放真实证件号
function make(birth: string) {
  const body = `110101${birth}123`;
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const sum = w.reduce((a, x, i) => a + x * Number(body[i]), 0);
  return body + "10X98765432"[sum % 11];
}

describe("parseIdCard", () => {
  const now = new Date(2026, 10, 4);
  it("计算年龄，生日当天满岁", () => {
    expect(parseIdCard(make("20081104"), now)).toEqual({ ok: true, age: 18 });
    expect(parseIdCard(make("20081105"), now)).toEqual({ ok: true, age: 17 });
  });
  it("校验位错误或日期不存在时拒绝", () => {
    const good = make("19900101");
    const bad = good.slice(0, 17) + (good[17] === "0" ? "1" : "0");
    expect(parseIdCard(bad, now).ok).toBe(false);
    expect(parseIdCard(make("19900230"), now).ok).toBe(false);
  });
});
