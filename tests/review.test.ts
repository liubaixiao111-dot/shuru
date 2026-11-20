import { describe, expect, it } from "vitest";
import { buildFixMessages, buildReviewMessages, parseReview, REVIEW_CHECKLIST } from "@/lib/story/review";

describe("写后审校", () => {
  it("没问题、JSON 损坏或 ok:false 但没有问题时都视为通过", () => {
    expect(parseReview('{"ok": true}')).toEqual({ ok: true });
    expect(parseReview("不是 JSON")).toEqual({ ok: true });
    expect(parseReview('{"ok": false, "issues": []}')).toEqual({ ok: true });
  });

  it("解析问题清单，最多 5 条", () => {
    const issues = Array.from({ length: 7 }, (_, i) => `问题${i}`);
    const r = parseReview("审校结果：\n" + JSON.stringify({ ok: false, issues }));
    expect(r).toEqual({ ok: false, issues: issues.slice(0, 5) });
  });

  it("审校提示带上清单、设定集秘密和作者想法", () => {
    const [sys, user] = buildReviewMessages({
      bible: {
        world: "",
        protagonist: "",
        characters: [{ name: "裴遥", desc: "", secret: "他认出了主角" }],
        style: "",
        facts: [],
        state: { time: "", place: "", threads: [] },
      },
      recap: ["第1章 回锋：验尸"],
      idea: "逼裴遥说实话",
      chapter: "正文",
    });
    for (const c of REVIEW_CHECKLIST) expect(sys.content).toContain(c);
    expect(user.content).toContain("他认出了主角");
    expect(user.content).toContain("逼裴遥说实话");
  });

  it("修正请求接在原对话后面，带上初稿和问题", () => {
    const msgs = buildFixMessages([{ role: "system", content: "s" }, { role: "user", content: "u" }], "初稿", ["裴遥不该知道密信"]);
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(msgs[2].content).toBe("初稿");
    expect(msgs[3].content).toContain("裴遥不该知道密信");
  });
});
