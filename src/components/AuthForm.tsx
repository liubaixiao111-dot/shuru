"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, { body: mode === "login" ? { email, password } : { email, password, nickname } });
      router.push("/shelf");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative pt-16">
      <div className="pointer-events-none absolute -right-24 -top-10 h-64 w-64 rounded-full bg-rose-500/25 blur-3xl" />
      <Link href="/" className="relative font-serif text-3xl font-bold">
        书入
      </Link>
      <h1 className="relative mt-8 text-2xl font-semibold">{mode === "login" ? "欢迎回来" : "创建账号"}</h1>
      <p className="relative mt-1 text-sm text-zinc-400">
        {mode === "login" ? "你的故事还在原地等你。" : "注册后送一份试用额度，可以先写起来。"}
      </p>
      <form onSubmit={submit} className="relative mt-8 space-y-3">
        {mode === "register" && (
          <input className="input" placeholder="昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        )}
        <input className="input" type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          placeholder={mode === "register" ? "密码（至少 8 位）" : "密码"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并开始"}
        </button>
      </form>
      <p className="relative mt-6 text-center text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            还没有账号？<Link className="text-rose-400" href="/register">注册</Link>
          </>
        ) : (
          <>
            已有账号？<Link className="text-rose-400" href="/login">登录</Link>
          </>
        )}
      </p>
    </main>
  );
}
