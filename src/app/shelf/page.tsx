import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";

const STATUS: Record<string, string> = { ongoing: "连载中", ending: "收尾中", finished: "已完结" };

export default async function ShelfPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const books = await prisma.book.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chapters: true } } },
  });

  return (
    <main>
      <TopBar />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">我的书架</h1>
        <Link href="/new" className="btn-primary">开新书</Link>
      </div>
      {books.length === 0 ? (
        <p className="card mt-6 text-center text-ink/60">书架还是空的，从一个场景开始写第一本吧。</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {books.map((b) => (
            <li key={b.id}>
              <Link href={`/book/${b.id}`} className="card block hover:border-accent/40">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-lg font-semibold">{b.title}</span>
                  <span className="text-xs text-ink/50">{STATUS[b.status] ?? b.status}</span>
                </div>
                <div className="mt-1 text-sm text-ink/60">
                  {b.genre} · {b._count.chapters} 章{b.adult ? " · 成人向" : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
