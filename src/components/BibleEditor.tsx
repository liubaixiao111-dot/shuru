"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Bible } from "@/lib/bible";

/** 设定集：AI 每章自动更新，作者可以随时修改 */
export function BibleEditor({ bookId, bible, onSaved }: { bookId: string; bible: Bible; onSaved: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Bible>(bible);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const clean: Bible = {
      ...draft,
      facts: draft.facts.map((f) => f.trim()).filter(Boolean),
      characters: draft.characters.filter((c) => c.name.trim()),
    };
    setBusy(true);
    setError("");
    try {
      await api(`/api/books/${bookId}/bible`, { method: "PUT", body: { bible: clean } });
      router.refresh();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: "world" | "protagonist" | "style", label: string) => (
    <label className="block">
      <span className="text-sm text-ink/60">{label}</span>
      <textarea
        className="input mt-1"
        rows={2}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="card mb-4 space-y-3">
      <p className="text-sm text-ink/60">AI 每写完一章都会更新设定集。你在这里改的内容，从下一章开始生效。</p>
      {field("world", "世界观")}
      {field("protagonist", "主角")}
      <div>
        <span className="text-sm text-ink/60">人物</span>
        {draft.characters.map((c, i) => (
          <div key={i} className="mt-1 flex gap-2">
            <input
              className="input w-24 shrink-0"
              value={c.name}
              onChange={(e) => {
                const characters = [...draft.characters];
                characters[i] = { ...c, name: e.target.value };
                setDraft({ ...draft, characters });
              }}
            />
            <input
              className="input"
              value={c.desc}
              onChange={(e) => {
                const characters = [...draft.characters];
                characters[i] = { ...c, desc: e.target.value };
                setDraft({ ...draft, characters });
              }}
            />
            <button
              className="text-ink/40"
              onClick={() => setDraft({ ...draft, characters: draft.characters.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="mt-2 text-sm text-accent"
          onClick={() => setDraft({ ...draft, characters: [...draft.characters, { name: "", desc: "" }] })}
        >
          + 添加人物
        </button>
      </div>
      <label className="block">
        <span className="text-sm text-ink/60">已发生的重要事实（一行一条）</span>
        <textarea
          className="input mt-1"
          rows={4}
          value={draft.facts.join("\n")}
          onChange={(e) => setDraft({ ...draft, facts: e.target.value.split("\n") })}
        />
      </label>
      {field("style", "文风")}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy}
        onClick={save}
      >
        保存设定
      </button>
    </div>
  );
}
