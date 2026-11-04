import { describe, expect, it } from "vitest";
import { buildMessages } from "@/lib/story/prompt";
import { fillName, SCENES } from "@/lib/scenes";

const base = {
  bookTitle: "测试",
  genre: "修仙",
  bible: {
    world: "w",
    protagonist: "p",
    characters: [{ name: "裴遥", desc: "少卿", goal: "天亮前结案", secret: "他认出了主角" }],
    style: "",
    facts: [],
    state: { time: "三更", place: "醉月楼", threads: ["谁会三寸回锋"] },
  },
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

  it("成人向开关切换内容尺度，两种尺度都带底线", () => {
    const normal = buildMessages(base)[0].content;
    const adult = buildMessages({ ...base, adult: true })[0].content;
    expect(normal).toContain("全年龄书");
    expect(adult).toContain("放开写");
    for (const sys of [normal, adult]) {
      expect(sys).toContain("不写露骨的性描写");
      expect(sys).toContain("不写未成年人相关的性内容");
    }
  });

  it("人物的目的、秘密和故事状态会交给模型", () => {
    const user = buildMessages(base)[1].content;
    expect(user).toContain("天亮前结案");
    expect(user).toContain("他认出了主角");
    expect(user).toContain("谁会三寸回锋");
  });
});

describe("场景库", () => {
  it("id 唯一，替换主角名后不残留占位符，每个预写场景都有人物目的和三条走向", () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    for (const s of SCENES) {
      const filled = JSON.stringify(fillName({ b: s.bible, o: s.opening }, "测试名"));
      expect(filled).not.toContain("{name}");
      if (s.opening) {
        expect(s.opening.suggestions).toHaveLength(3);
        expect(s.bible.characters.some((c) => c.goal && c.secret)).toBe(true);
        expect(s.opening.content.length).toBeGreaterThan(600);
      }
    }
  });
});

describe("设定集的隐藏信息", () => {
  it("阅读界面拿不到秘密，保存时秘密和状态会合并回来", async () => {
    const { publicBible, mergeHidden } = await import("@/lib/bible");
    const full = base.bible;
    const pub = publicBible(full);
    expect(JSON.stringify(pub)).not.toContain("他认出了主角");
    const edited = { ...pub, characters: [{ name: "裴遥", desc: "改过的描述" }], state: { time: "", place: "", threads: [] } };
    const merged = mergeHidden(edited, full);
    expect(merged.characters[0]).toMatchObject({ desc: "改过的描述", secret: "他认出了主角", goal: "天亮前结案" });
    expect(merged.state.threads).toEqual(["谁会三寸回锋"]);
  });
});

describe("剧情主动修正规则", () => {
  it("写作提示包含直接发生/尝试、最小因果桥、追补设定和人物信息边界", () => {
    const all = buildMessages(base).map((m) => m.content).join("\n");
    expect(all).toContain("本段直接兑现");
    expect(all).toContain("只写主角的尝试过程");
    expect(all).toContain("最小的合理因果");
    expect(all).toContain("只能根据自己知道的信息行动");
    expect(buildMessages({ ...base, mode: "retcon" })[1].content).toContain("其实……");
  });
});

describe("回合规则", () => {
  it("结尾要把球交回给作者，不替主角做主", () => {
    const sys = buildMessages(base)[0].content;
    expect(sys).toContain("结尾必须把球交回给作者");
    expect(sys).toContain("不替主角说作者没说过的有分量的话");
  });

  it("不同输入方式带不同写法，偏好会进提示词", () => {
    const cont = buildMessages({ ...base, idea: null, mode: "continue" })[1].content;
    expect(cont).toContain("主角只做不需要决定的细微反应");
    const retcon = buildMessages({ ...base, idea: "其实我带了刀", mode: "retcon" })[1].content;
    expect(retcon).toContain("不能让别人凭空对主角产生好感");
    const sys = buildMessages({
      ...base,
      prefs: {
        pace: "slow",
        person: "second",
        tone: "daily",
        innerView: true,
        assistant: false,
        offscreen: false,
        boundaries: ["动物受伤"],
        paused: true,
      },
    });
    expect(sys[0].content).toContain("用“你”称呼主角");
    expect(sys[0].content).toContain("日常向");
    expect(sys[0].content).toContain("不要动物受伤");
    expect(sys[0].content).toContain("暂时冻结");
    expect(sys[1].content).toContain("作者刚才按了暂停");
  });
});
