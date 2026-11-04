"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { BookCover } from "./BookCover";

export interface SceneCard {
  id: string;
  genre: string;
  name: string;
  hook: string;
  defaultTitle: string;
  protagonistName: string;
  questions: { key: string; label: string; placeholder: string }[] | null;
}

const GENRES = ["悬疑", "仙侠", "玄幻", "都市", "言情", "科幻", "历史", "武侠", "惊悚", "其他"];

export function NewBookForm({ scenes, adultEnabled }: { scenes: SceneCard[]; adultEnabled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"scene" | "original">("scene");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const scene = scenes.find((s) => s.id === sceneId) ?? null;

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [genre, setGenre] = useState(GENRES[0]);
  const [premise, setPremise] = useState("");
  const [world, setWorld] = useState("");
  const [protagonist, setProtagonist] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(s: SceneCard) {
    setSceneId(s.id);
    setTitle(s.defaultTitle);
    setName(s.questions ? "" : s.protagonistName);
    setError("");
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const payload =
        tab === "scene"
          ? { sceneId, title, protagonistName: name || undefined, adult, answers: scene?.questions ? answers : undefined }
          : { title, protagonistName: name || undefined, adult, original: { genre, premise, world, protagonist } };
      const res = await api<{ id: string; needsFirstChapter: boolean }>("/api/books", { body: payload });
      router.push(`/book/${res.id}${res.needsFirstChapter ? "?start=1" : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const common = (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-500">书名</span>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} />
      </label>
      {!(tab === "scene" && scene?.questions) && (
        <label className="block">
          <span className="text-xs text-zinc-500">主角名字</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
        </label>
      )}
      {adultEnabled && (
        <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10">
          <span>
            成人向
            <span className="ml-2 text-xs text-zinc-500">成熟题材，不含露骨内容</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-rose-500" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        </label>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || !title.trim()} onClick={submit}>
        {busy ? "正在开书…" : "开始写"}
      </button>
    </div>
  );

  return (
    <div className="mt-6">
      <div className="inline-flex rounded-full bg-white/5 p-1 text-sm ring-1 ring-white/10">
        {(["scene", "original"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-1.5 transition ${tab === t ? "bg-white text-black" : "text-zinc-400"}`}
          >
            {t === "scene" ? "精选开场" : "原创设定"}
          </button>
        ))}
      </div>

      {tab === "scene" ? (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6">
            {scenes.map((s) => (
              <li key={s.id}>
                <button onClick={() => pick(s)} className="w-full text-left">
                  <BookCover title={s.name} genre={s.genre} />
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">{s.hook}</p>
                </button>
              </li>
            ))}
          </ul>

          {scene && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSceneId(null)} />
              <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-2xl overflow-y-auto rounded-t-3xl bg-[#17171a] p-5 pb-8 ring-1 ring-white/10">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
                <div className="mb-5 flex gap-4">
                  <BookCover title={scene.name} genre={scene.genre} className="w-20 shrink-0" />
                  <div>
                    <p className="text-xs text-rose-400">{scene.genre}</p>
                    <p className="mt-1 font-serif text-lg font-semibold">{scene.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{scene.hook}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {scene.questions?.map((q) => (
                    <label key={q.key} className="block">
                      <span className="text-xs text-zinc-500">{q.label}</span>
                      <textarea
                        className="input mt-1"
                        rows={2}
                        placeholder={q.placeholder}
                        value={answers[q.key] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                      />
                    </label>
                  ))}
                  {common}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 ${
                  genre === g ? "bg-white text-black ring-white" : "text-zinc-400 ring-white/10"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-zinc-500">一句话设定</span>
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="例如：一个只能看见别人剩余寿命的外卖员，某天送餐时发现客户只剩 24 小时"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
            />
          </label>
          <details className="rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/5">
            <summary className="cursor-pointer text-sm text-zinc-400">更多设定（可选）</summary>
            <textarea className="input mt-3" rows={3} placeholder="世界观" value={world} onChange={(e) => setWorld(e.target.value)} />
            <textarea
              className="input mt-2"
              rows={2}
              placeholder="主角是什么样的人"
              value={protagonist}
              onChange={(e) => setProtagonist(e.target.value)}
            />
          </details>
          {common}
        </div>
      )}
    </div>
  );
}
