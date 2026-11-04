import { describe, expect, it } from "vitest";
import { detectMode } from "@/lib/story/modes";
import { limitRelationChanges, publicBible, type Bible } from "@/lib/bible";

describe("detectMode", () => {
  it("按作者的话判断输入方式", () => {
    expect(detectMode(null).mode).toBe("continue");
    expect(detectMode("继续").mode).toBe("continue");
    expect(detectMode("其实我早就认识她").mode).toBe("retcon");
    expect(detectMode("刚才不算，改成我转身就走")).toEqual({ mode: "rewrite", idea: "我转身就走" });
    expect(detectMode("我不说话，看她怎么做").mode).toBe("wait");
    expect(detectMode("快进到明天早上").mode).toBe("skip");
    expect(detectMode("来点转折").mode).toBe("twist");
    expect(detectMode("我推开门").mode).toBe("action");
  });
  it("按钮优先", () => {
    expect(detectMode("我推开门", "twist").mode).toBe("twist");
  });
});

const bible = (trust: number, why = "", stage = "陌生"): Bible => ({
  world: "",
  protagonist: "",
  style: "",
  facts: [],
  state: { time: "", place: "", threads: [] },
  characters: [{ name: "裴遥", desc: "少卿", goal: "结案", secret: "认出了主角", relation: { trust, stage, tension: 0, why } }],
});

describe("关系慢热", () => {
  it("一段之内信任最多变 2", () => {
    const r = limitRelationChanges(bible(0), bible(5, "你替他挡了一刀"), { frozen: false });
    expect(r.characters[0].relation?.trust).toBe(2);
  });
  it("没有原因的变化不算，“其实”不能追加好感", () => {
    expect(limitRelationChanges(bible(0), bible(2, ""), { frozen: false }).characters[0].relation?.trust).toBe(0);
    expect(limitRelationChanges(bible(0), bible(2, "旧识"), { frozen: true }).characters[0].relation?.trust).toBe(0);
  });
  it("界面上只给人话，不露数值和秘密", () => {
    const pub = publicBible(bible(-3, "x", "熟络"));
    const json = JSON.stringify(pub);
    expect(json).not.toContain("认出了主角");
    expect(json).not.toContain("trust");
    expect(pub.characters[0].bond).toBe("熟络，提防你");
  });
});
