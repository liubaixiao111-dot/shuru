import { describe, expect, it } from "vitest";
import { MarkerSplitter, parseChapter } from "@/lib/story/parse";
import { META_MARKER } from "@/lib/story/prompt";

describe("parseChapter", () => {
  it("拆出标题、正文和 META", () => {
    const raw = `后山的声音\n\n第一段。\n第二段。\n${META_MARKER}\n{"summary":"摘要","suggestions":["甲","乙","丙","丁"],"bible":{"world":"青云宗","protagonist":"林砚","characters":[],"style":"","facts":["x"]}}`;
    const p = parseChapter(raw, "第1章");
    expect(p.title).toBe("后山的声音");
    expect(p.content).toBe("第一段。\n第二段。");
    expect(p.summary).toBe("摘要");
    expect(p.suggestions).toEqual(["甲", "乙", "丙"]);
    expect(p.bible?.world).toBe("青云宗");
  });

  it("去掉模型自己加的“第几章”前缀", () => {
    expect(parseChapter("第十二章：夜袭\n\n正文", "x").title).toBe("夜袭");
  });

  it("META 损坏时保留正文", () => {
    const p = parseChapter(`标题\n\n正文内容\n${META_MARKER}\n{坏的json`, "第3章");
    expect(p.content).toBe("正文内容");
    expect(p.bible).toBeNull();
    expect(p.summary).toBe("正文内容");
  });

  it("没有标题行时用备用标题", () => {
    const long = "这是一段很长很长的第一行内容，根本不像标题，模型直接开始写正文了，而且写了很多字";
    const p = parseChapter(`${long}\n第二行`, "第2章");
    expect(p.title).toBe("第2章");
    expect(p.content).toContain(long);
  });
});

describe("MarkerSplitter", () => {
  it("标记被拆在两个分片里也能挡住 META", () => {
    const s = new MarkerSplitter();
    const half = Math.floor(META_MARKER.length / 2);
    const chunks = ["正文一", "正文二", META_MARKER.slice(0, half), META_MARKER.slice(half) + '{"a":1}', "更多"];
    const out = chunks.map((c) => s.push(c)).join("") + s.flush();
    expect(out).toBe("正文一正文二");
  });

  it("没有标记时输出全部内容", () => {
    const s = new MarkerSplitter();
    const out = ["一二三", "四五六七八九十"].map((c) => s.push(c)).join("") + s.flush();
    expect(out).toBe("一二三四五六七八九十");
  });
});
