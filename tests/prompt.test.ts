import { describe, expect, it } from "vitest";
import { buildMessages } from "@/lib/story/prompt";
import { fillName, SCENES } from "@/lib/scenes";

const base = {
  bookTitle: "测试",
  genre: "修仙",
  bible: { world: "w", protagonist: "p", characters: [], style: "", facts: [] },
  adult: false,
  history: [1, 2, 3].map((i) => ({ index: i, title: `t${i}`, summary: `s${i}`, content: `c${i}` })),
  idea: "让他突破",
  nextIndex: 4,
  ending: null,
};

describe("buildMessages", () => {
  it("较早章节只给摘要，最近两章给全文", () => {
    const user = buildMessages(base)[1].content;
    expect(user).toContain("第1章 t1：s1");
    expect(user).not.toContain("c1");
    expect(user).toContain("c2");
    expect(user).toContain("c3");
    expect(user).toContain("让他突破");
  });

  it("正常连载时不带收尾指令，最后一章带结局指令", () => {
    expect(buildMessages(base)[1].content).not.toContain("收尾指令");
    expect(buildMessages({ ...base, ending: { left: 1 } })[1].content).toContain("全书最后一章");
    expect(buildMessages({ ...base, ending: { left: 3 } })[1].content).toContain("3 章内完结");
  });

  it("成人向开关切换内容要求", () => {
    expect(buildMessages(base)[0].content).toContain("全年龄");
    expect(buildMessages({ ...base, adult: true })[0].content).toContain("绝不出现露骨的性描写");
  });
});

describe("场景库", () => {
  it("共 10 个场景，id 唯一，替换主角名后不残留占位符", () => {
    expect(SCENES).toHaveLength(10);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(10);
    for (const s of SCENES) {
      const filled = JSON.stringify(fillName({ b: s.bible, o: s.opening }, "测试名"));
      expect(filled).not.toContain("{name}");
    }
  });
});
