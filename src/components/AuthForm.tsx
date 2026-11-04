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
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">{mode === "login" ? "登录书入" : "注册书入"}</h1>
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并开始"}
      </button>
      <p className="text-center text-sm text-ink/60">
        {mode === "login" ? (
          <>还没有账号？<Link className="text-accent" href="/register">注册</Link></>
        ) : (
          <>已有账号？<Link className="text-accent" href="/login">登录</Link></>
        )}
      </p>
    </form>
  );
}
