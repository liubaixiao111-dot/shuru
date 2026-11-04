import { describe, expect, it } from "vitest";
import { latestLeaf, pathTo } from "@/lib/tree";

const t = (n: number) => new Date(2026, 0, 1, 0, 0, n);
const nodes = [
  { id: "a", parentId: null, createdAt: t(1) },
  { id: "b", parentId: "a", createdAt: t(2) },
  { id: "c", parentId: "b", createdAt: t(3) },
  { id: "b2", parentId: "a", createdAt: t(4) },
  { id: "c2", parentId: "b2", createdAt: t(5) },
];

describe("章节树", () => {
  it("pathTo 返回从根到当前章的顺序", () => {
    expect(pathTo(nodes, "c").map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(pathTo(nodes, null)).toEqual([]);
  });

  it("latestLeaf 沿最新分支走到底", () => {
    expect(latestLeaf(nodes, "a")).toBe("c2");
    expect(latestLeaf(nodes, "b")).toBe("c");
  });
});
