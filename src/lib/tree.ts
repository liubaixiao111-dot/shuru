export interface TreeNode {
  id: string;
  parentId: string | null;
}

/** 从根走到 headId 的章节路径（按阅读顺序） */
export function pathTo<T extends TreeNode>(nodes: T[], headId: string | null | undefined): T[] {
  if (!headId) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: T[] = [];
  const seen = new Set<string>();
  let cur = byId.get(headId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path.reverse();
}

/** 沿某个章节一直往下走到最新的叶子（每层取最新创建的子节点） */
export function latestLeaf<T extends TreeNode & { createdAt: Date }>(nodes: T[], fromId: string): string {
  let id = fromId;
  for (;;) {
    const kids = nodes.filter((n) => n.parentId === id);
    if (kids.length === 0) return id;
    kids.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    id = kids[0].id;
  }
}
