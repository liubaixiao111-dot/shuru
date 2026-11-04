import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { effectiveBible, parseBible, publicBible } from "@/lib/bible";
import { pathTo } from "@/lib/tree";
import { Reader, type ReaderChapter } from "@/components/Reader";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { start } = await searchParams;
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) notFound();

  const all = await prisma.chapter.findMany({ where: { bookId: id }, orderBy: { createdAt: "asc" } });
  const path = pathTo(all, book.headChapterId);
  const bookmarks = await prisma.bookmark.findMany({ where: { bookId: id }, orderBy: { createdAt: "desc" } });
  const chapters: ReaderChapter[] = path.map((c) => {
    const siblings = all.filter((s) => s.parentId === c.parentId);
    return {
      id: c.id,
      parentId: c.parentId,
      index: c.index,
      title: c.title,
      content: c.content,
      idea: c.idea,
      suggestions: JSON.parse(c.suggestions) as string[],
      isFinale: c.isFinale,
      reviewNotes: JSON.parse(c.reviewNotes) as string[],
      siblingIds: siblings.map((s) => s.id),
    };
  });

  return (
    <main>
      <Reader
        book={{
          id: book.id,
          title: book.title,
          status: book.status,
          endingLeft: book.endingLeft,
          adult: book.adult,
          lastReadChapterId: book.lastReadChapterId,
        }}
        bookmarks={bookmarks.map((b) => ({ chapterId: b.chapterId, excerpt: b.excerpt }))}
        chapters={chapters}
        bible={publicBible(parseBible(effectiveBible(book.bible, path.at(-1)?.bible)))}
        autoStart={start === "1" && chapters.length === 0}
      />
    </main>
  );
}
