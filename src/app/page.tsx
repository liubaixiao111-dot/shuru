import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SCENES } from "@/lib/scenes";
import { BookCover } from "@/components/BookCover";

export default async function Home() {
  if (await currentUser()) redirect("/shelf");
  const featured = SCENES.filter((s) => s.opening);
  return (
    <main className="pb-16">
      <section className="relative -mx-4 overflow-hidden px-6 pb-12 pt-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-40 h-60 w-60 rounded-full bg-amber-500/20 blur-3xl" />
        <p className="relative text-sm tracking-[.3em] text-zinc-400">SHURU</p>
        <h1 className="relative mt-3 font-serif text-5xl font-bold">书入</h1>
        <p className="relative mt-5 text-2xl font-semibold leading-snug">
          你写一句，
          <br />
          <span className="bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">故事就往前走一步。</span>
        </p>
        <p className="relative mt-4 text-sm leading-relaxed text-zinc-400">
          一本跟着你的想法走的小说。人物有自己的算盘，剧情不会因为你是主角就让路。写多久、何时完结，由你决定。
        </p>
        <div className="relative mt-8 flex gap-3">
          <Link className="btn-primary" href="/register">
            开始写我的故事
          </Link>
          <Link className="btn-ghost" href="/login">
            登录
          </Link>
        </div>
      </section>

      <h2 className="mb-3 text-sm font-medium text-zinc-400">今晚从哪一个故事开始</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {featured.map((s) => (
          <Link key={s.id} href="/register" className="w-40 shrink-0 snap-start">
            <BookCover title={s.name} genre={s.genre} />
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{s.hook}</p>
          </Link>
        ))}
      </div>

      <ul className="mt-10 grid grid-cols-3 gap-3 text-center text-xs text-zinc-400">
        <li className="card p-4">
          <div className="text-lg text-white">✍️</div>想怎么写就怎么写
        </li>
        <li className="card p-4">
          <div className="text-lg text-white">🎙️</div>说一句也能续写
        </li>
        <li className="card p-4">
          <div className="text-lg text-white">🌿</div>随时回到分叉点
        </li>
      </ul>
    </main>
  );
}
