"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  nickname: string;
  email: string;
  platformTokens: number;
  ageVerified: boolean;
  adultEnabled: boolean;
  providers: { id: string; name: string; defaultModel: string; keyHint: string }[];
  keys: { provider: string; model: string; isDefault: boolean }[];
  usage: { mode: string; chapters: number; tokens: number }[];
}

export function SettingsPanel(p: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState(p.providers[0].id);
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [realName, setRealName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const usingByok = p.keys.find((k) => k.isDefault);
  const current = p.providers.find((x) => x.id === provider)!;

  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const name = (id: string) => p.providers.find((x) => x.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      {msg && <p className={`card text-sm ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}

      <section className="card space-y-2">
        <h2 className="text-base font-semibold">写作额度</h2>
        <p className="text-sm text-zinc-300">
          当前使用：{usingByok ? `自带 Key（${name(usingByok.provider)}），不消耗平台额度` : "平台额度"}
        </p>
        <p className="text-sm text-zinc-300">平台剩余额度：{Math.max(0, p.platformTokens).toLocaleString()} token</p>
        <p className="text-xs text-zinc-500">充值即将开放。</p>
        {p.usage.length > 0 && (
          <ul className="text-sm text-zinc-400">
            {p.usage.map((u) => (
              <li key={u.mode}>
                近 30 天{u.mode === "byok" ? "自带 Key" : "平台额度"}：写了 {u.chapters} 章，消耗 {u.tokens.toLocaleString()} token
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold">自带模型 API Key</h2>
        <p className="text-sm text-zinc-400">填入你自己的 Key 后，写作消耗的是你自己的 token。Key 加密保存，只用于为你生成章节。</p>
        {p.keys.length > 0 && (
          <ul className="space-y-2 text-sm">
            {p.keys.map((k) => (
              <li key={k.provider} className="flex items-center justify-between gap-2">
                <span>
                  {name(k.provider)} · {k.model}
                  {k.isDefault && <span className="ml-2 text-rose-400">使用中</span>}
                </span>
                <span className="flex gap-2">
                  {!k.isDefault && (
                    <button
                      className="text-rose-400"
                      onClick={() => run(() => api("/api/settings/keys", { method: "PATCH", body: { provider: k.provider } }), "已切换")}
                    >
                      使用
                    </button>
                  )}
                  <button
                    className="text-zinc-500"
                    onClick={() => run(() => api(`/api/settings/keys?provider=${k.provider}`, { method: "DELETE" }), "已删除")}
                  >
                    删除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {usingByok && (
          <button
            className="text-sm text-rose-400"
            onClick={() => run(() => api("/api/settings/keys", { method: "PATCH", body: { provider: null } }), "已切回平台额度")}
          >
            改用平台额度
          </button>
        )}
        <div className="space-y-2 border-t border-white/10 pt-3">
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {p.providers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder={`模型名（默认 ${current.defaultModel}）`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder={`API Key（${current.keyHint}）`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={busy || !key}
            onClick={() =>
              run(async () => {
                await api("/api/settings/keys", { body: { provider, model, key } });
                setKey("");
                setModel("");
              }, "Key 验证通过，已保存并启用")
            }
          >
            {busy ? "验证中…" : "验证并保存"}
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold">成人向内容</h2>
        <p className="text-sm text-zinc-400">
          开启后，可以在新书中写暴力、黑暗、惊悚等成熟题材和含蓄的情感描写，不含露骨内容。需要先完成年龄验证。
        </p>
        {!p.ageVerified ? (
          <div className="space-y-2">
            <input className="input" placeholder="真实姓名" value={realName} onChange={(e) => setRealName(e.target.value)} />
            <input className="input" placeholder="身份证号" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            <p className="text-xs text-zinc-500">仅用于确认年满 18 岁，我们不保存你的姓名和证件号。</p>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() =>
                run(() => api("/api/settings/verify-age", { body: { realName, idNumber } }), "验证通过，现在可以开启成人向了")
              }
            >
              验证年龄
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-rose-500"
              checked={p.adultEnabled}
              onChange={(e) =>
                run(
                  () => api("/api/settings/adult", { body: { enabled: e.target.checked } }),
                  e.target.checked ? "已开启成人向" : "已关闭成人向",
                )
              }
            />
            开启成人向
          </label>
        )}
      </section>

      <section className="card flex items-center justify-between text-sm">
        <span className="text-zinc-400">
          {p.nickname} · {p.email}
        </span>
        <button
          className="text-zinc-500"
          onClick={async () => {
            await api("/api/auth/logout", { body: {} });
            router.push("/");
            router.refresh();
          }}
        >
          退出登录
        </button>
      </section>
    </div>
  );
}
