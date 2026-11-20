"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BookCover } from "./BookCover";

interface World {
  id: string;
  title: string;
  modes: string[];
  summary: string;
}

type Mode = "daily" | "pressure" | "random";

/**
 * 开新书（叙事引擎）：选氛围（日常 / 压力 / 随便），可以挑一个世界，也可以交给随机。
 */
export function AtNewBookForm({ adultEnabled }: { adultEnabled: boolean }) {
  const router = useRouter();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<World | null | "random">(null);
  const [mode, setMode] = useState<Mode>("pressure");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [npcGender, setNpcGender] = useState("any");
  const [adult, setAdult] = useState(adultEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<{ worlds: World[]; total: number }>(`/api/at/worlds${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        setWorlds(r.worlds);
        setTotal(r.total);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const w = picked && picked !== "random" ? picked : null;
      const res = await api<{ id: string }>("/api/books", {
        body: {
          title: "auto",
          adult,
          at: {
            mode,
            ...(w ? { worldId: w.id } : {}),
            ...(name.trim() ? { playerName: name.trim() } : {}),
            ...(gender ? { playerGender: gender } : {}),
            npcGender,
          },
        },
      });
      router.push(`/book/${res.id}?start=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const sheetWorld = picked && picked !== "random" ? picked : null;
  const modes: [Mode, string, string][] = [
    ["daily", "日常", "细水长流，慢慢相处"],
    ["pressure", "压力", "开局即危机，步步为营"],
    ["random", "随便", "交给运气"],
  ];

  return (
    <div className="mt-6">
      <button
        onClick={() => setPicked("random")}
        className="w-full rounded-2xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-5 py-4 text-left ring-1 ring-white/10"
      >
        <div className="text-base font-medium text-white">随机开一局</div>
        <div className="mt-0.5 text-xs text-zinc-400">从 {total || "200 多"} 个世界里抽地点、人物、钩子</div>
      </button>

      <input className="input mt-5" placeholder="搜世界：民国、港口、仙侠、职场……" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && !picked && <p className="mt-2 text-sm text-rose-400">{error}</p>}

      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
        {worlds.map((w) => (
          <li key={w.id}>
            <button onClick={() => setPicked(w)} className="w-full text-left">
              <BookCover title={w.title} genre={w.modes.includes("daily") ? "日常" : "压力"} />
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">{w.summary}</p>
            </button>
          </li>
        ))}
      </ul>
      {loading && <p className="mt-6 text-center text-sm text-zinc-500">正在加载世界…</p>}
      {!loading && worlds.length === 0 && !error && <p className="mt-6 text-center text-sm text-zinc-500">没有对得上的世界，换个词试试</p>}

      {picked && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setPicked(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-2xl overflow-y-auto rounded-t-3xl bg-[#17171a] p-5 pb-8 ring-1 ring-white/10">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            {sheetWorld ? (
              <div className="mb-5 flex gap-4">
                <BookCover title={sheetWorld.title} genre="" className="w-20 shrink-0" />
                <div>
                  <p className="font-serif text-lg font-semibold">{sheetWorld.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{sheetWorld.summary}</p>
                </div>
              </div>
            ) : (
              <p className="mb-5 font-serif text-lg font-semibold">随机开一局</p>
            )}
            <div className="space-y-4">
              <div>
                <span className="text-xs text-zinc-500">想选哪种氛围？</span>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {modes
                    .filter(([v]) => !sheetWorld || v === "random" || sheetWorld.modes.includes(v))
                    .map(([v, label, hint]) => (
                      <button
                        key={v}
                        onClick={() => setMode(v)}
                        className={`rounded-2xl px-3 py-2.5 text-left ring-1 ${mode === v ? "bg-white/10 ring-white/40" : "ring-white/10"}`}
                      >
                        <div className="text-sm text-white">{label}</div>
                        <div className="mt-0.5 text-[11px] leading-tight text-zinc-500">{hint}</div>
                      </button>
                    ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-zinc-500">你的名字（可不填）</span>
                  <input className="input mt-1" maxLength={12} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">你的性别</span>
                  <select className="input mt-1" value={gender} onChange={(e) => setGender(e.target.value as "" | "male" | "female")}>
                    <option value="">不指定</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-zinc-500">希望遇到的人</span>
                <select className="input mt-1" value={npcGender} onChange={(e) => setNpcGender(e.target.value)}>
                  <option value="any">不限</option>
                  <option value="mostly_female">女性为主</option>
                  <option value="mostly_male">男性为主</option>
                  <option value="female_only">只要女性</option>
                  <option value="male_only">只要男性</option>
                  <option value="mixed">男女都有</option>
                </select>
              </label>
              {adultEnabled && (
                <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10">
                  <span>成人向</span>
                  <input type="checkbox" className="h-5 w-5 accent-rose-500" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                </label>
              )}
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <button className="btn-primary w-full" disabled={busy} onClick={submit}>
                {busy ? "正在开局…" : "开局"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
