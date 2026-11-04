"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export interface SceneCard {
  id: string;
  genre: string;
  name: string;
  hook: string;
  defaultTitle: string;
  protagonistName: string;
  questions: { key: string; label: string; placeholder: string }[] | null;
}

const GENRES = ["修仙", "玄幻", "都市", "言情", "悬疑", "武侠", "科幻", "末世", "历史", "其他"];

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
        <span className="text-sm text-ink/60">书名</span>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} />
      </label>
      {!(tab === "scene" && scene?.questions) && (
        <label className="block">
          <span className="text-sm text-ink/60">主角名字</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
        </label>
      )}
      {adultEnabled && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          这本书开启成人向（成熟题材，不含露骨内容）
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || !title.trim()} onClick={submit}>
        {busy ? "正在开书…" : "开始写"}
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-ink/15 bg-white p-1 text-sm">
        {(["scene", "original"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1 ${tab === t ? "bg-accent text-white" : "text-ink/70"}`}
          >
            {t === "scene" ? "从场景开始" : "原创设定"}
          </button>
        ))}
      </div>

      {tab === "scene" ? (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {scenes.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => pick(s)}
                  className={`card h-full w-full text-left ${sceneId === s.id ? "border-accent ring-1 ring-accent" : ""}`}
                >
                  <div className="text-xs text-accent">{s.genre}</div>
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-1 text-sm text-ink/60">{s.hook}</div>
                </button>
              </li>
            ))}
          </ul>
          {scene && (
            <div className="card mt-4 space-y-3">
              {scene.questions?.map((q) => (
                <label key={q.key} className="block">
                  <span className="text-sm text-ink/60">{q.label}</span>
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
          )}
        </>
      ) : (
        <div className="card space-y-3">
          <label className="block">
            <span className="text-sm text-ink/60">题材</span>
            <select className="input mt-1" value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-ink/60">一句话设定</span>
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="例如：一个只能看见别人剩余寿命的外卖员，某天送餐时发现客户只剩 24 小时"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
            />
          </label>
          <details>
            <summary className="cursor-pointer text-sm text-ink/60">更多设定（可选）</summary>
            <textarea
              className="input mt-2"
              rows={3}
              placeholder="世界观"
              value={world}
              onChange={(e) => setWorld(e.target.value)}
            />
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
