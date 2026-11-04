import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SCENES } from "@/lib/scenes";

export default async function Home() {
  if (await currentUser()) redirect("/shelf");
  return (
    <main className="pt-16">
      <h1 className="font-serif text-4xl font-bold">书入</h1>
      <p className="mt-3 text-lg text-ink/70">你来定方向，AI 来写好。一本跟着你的想法走的小说，写多久、何时完结，都由你。</p>
      <div className="mt-8 flex gap-3">
        <Link className="btn-primary" href="/register">开始写我的故事</Link>
        <Link className="btn-ghost" href="/login">登录</Link>
      </div>
      <h2 className="mt-12 text-sm font-medium text-ink/50">可以从这些场景开始</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {SCENES.map((s) => (
          <li key={s.id} className="card">
            <div className="text-xs text-accent">{s.genre}</div>
            <div className="font-medium">{s.name}</div>
            <div className="mt-1 text-sm text-ink/60">{s.hook}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
