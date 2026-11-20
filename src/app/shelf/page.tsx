import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pathTo } from "@/lib/tree";
import { BookCover } from "@/components/BookCover";
import { TabBar } from "@/components/TabBar";

const STATUS: Record<string, string> = { ongoing: "连载中", ending: "收尾中", finished: "已完结" };

export default async function ShelfPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { sort } = await searchParams;
  const books = await prisma.book.findMany({
    where: { userId: user.id },
    include: { chapters: { select: { id: true, parentId: true, index: true, content: true } } },
  });

  // 每本书沿当前分支统计章数、字数和读到第几章
  const rows = books.map((b) => {
    const path = pathTo(b.chapters, b.headChapterId);
    const read = path.find((c) => c.id === b.lastReadChapterId);
    return {
      id: b.id,
      title: b.title,
      genre: b.genre,
      status: b.status,
      chapters: path.length,
      words: path.reduce((n, c) => n + c.content.length, 0),
      readIndex: read?.index ?? null,
      lastReadAt: b.lastReadAt,
      updatedAt: b.updatedAt,
    };
  });
  const byRead = (r: (typeof rows)[number]) => (r.lastReadAt ?? r.updatedAt).getTime();
  rows.sort((a, b) =>
    sort === "updated" ? b.updatedAt.getTime() - a.updatedAt.getTime() : byRead(b) - byRead(a),
  );
  const current = rows.find((r) => r.lastReadAt) ?? null;

  return (
    <main className="pb-28 pt-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">你好，{user.nickname}</p>
          <h1 className="mt-1 text-2xl font-semibold">我的书架</h1>
        </div>
        {rows.length > 1 && (
          <div className="flex gap-3 text-xs text-zinc-500">
            <Link href="/shelf" className={sort !== "updated" ? "text-white" : ""}>
              最近阅读
            </Link>
            <Link href="/shelf?sort=updated" className={sort === "updated" ? "text-white" : ""}>
              最近更新
            </Link>
          </div>
        )}
      </div>

      {current && (
        <Link
          href={`/book/${current.id}`}
          className="relative mt-6 flex gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-white/[.08] to-white/[.02] p-4 ring-1 ring-white/10"
        >
          <BookCover title={current.title} genre={current.genre} className="w-20 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
            <div>
              <p className="text-xs text-zinc-400">继续阅读</p>
              <p className="mt-1 truncate font-serif text-lg font-semibold">{current.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                读到第 {current.readIndex ?? 1} 章 / 共 {current.chapters} 章
              </p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500"
                style={{ width: `${Math.round(((current.readIndex ?? 1) / Math.max(1, current.chapters)) * 100)}%` }}
              />
            </div>
          </div>
        </Link>
      )}

      {rows.length === 0 ? (
        <div className="card mt-10 text-center">
          <p className="text-zinc-400">书架还是空的</p>
          <Link href="/new" className="btn-primary mt-4">
            写第一本书
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/book/${b.id}`}>
                <BookCover title={b.title} genre={b.genre} />
                <p className="mt-2 truncate text-sm">{b.title}</p>
                <p className="text-[11px] text-zinc-500">
                  {STATUS[b.status] ?? b.status} · {b.chapters} 章 · {b.words >= 10000 ? `${(b.words / 10000).toFixed(1)} 万字` : `${b.words} 字`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TabBar />
    </main>
  );
}
