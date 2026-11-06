"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Segment } from "./StoryPanel";

interface Prefs {
  inner_view?: boolean;
  assistant?: boolean;
  offscreen_simulation?: boolean;
  person?: "second" | "first" | "third";
  pace?: "slow" | "standard" | "direct";
  explicitness?: "subtle" | "standard" | "explicit";
}
interface Safety {
  paused: boolean;
  /** 运行时给的是边界原话列表 */
  boundaries: (string | { id?: string; text?: string })[];
}

/** 叙事引擎的故事面板：状态（六行 / 状态+）、写法偏好、边界与暂停 */
export function AtStoryPanel({ bookId, onPaused }: { bookId: string; onPaused: (p: boolean) => void }) {
  const [tab, setTab] = useState<"state" | "detail" | "prefs">("state");
  const [lines, setLines] = useState<string[] | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [safety, setSafety] = useState<Safety | null>(null);
  const [boundary, setBoundary] = useState("");
  const [error, setError] = useState("");

  const call = <T,>(body: Record<string, unknown>) => api<T>(`/api/books/${bookId}/at`, { body });

  async function loadContext() {
    const c = await call<{ preferences: Prefs; safety: Safety }>({ action: "context" });
    setPrefs(c.preferences);
    setSafety(c.safety);
    onPaused(!!c.safety?.paused);
  }

  useEffect(() => {
    void (async () => {
      try {
        const s = await call<{ lines: string[] }>({ action: "status", level: "brief" });
        setLines(s.lines);
        await loadContext();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "detail" || detail !== null) return;
    void call<{ text?: string; lines?: string[] }>({ action: "status", level: "detail" })
      .then((d) => setDetail(d.text ?? (d.lines ?? []).join("\n")))
      .catch((e) => setError((e as Error).message));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(patch: Prefs) {
    setError("");
    setPrefs({ ...prefs, ...patch });
    try {
      await call({ action: "prefs", prefs: patch });
    } catch (e) {
      setError((e as Error).message);
      await loadContext();
    }
  }

  async function boundaryOp(op: "add" | "remove", b: { text?: string; boundaryId?: string }) {
    setError("");
    try {
      await call({ action: "boundary", op, ...b });
      await loadContext();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const NUM = "①②③④⑤⑥";
  return (
    <div>
      <div className="mb-4 flex gap-5 text-sm">
        {(
          [
            ["state", "状态"],
            ["detail", "状态+"],
            ["prefs", "写法与边界"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "font-semibold text-accent" : "opacity-60"} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {tab === "state" &&
        (lines ? (
          <ol className="space-y-2.5 text-sm leading-relaxed">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="opacity-50">{NUM[i] ?? "·"}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm opacity-50">正在读取…</p>
        ))}

      {tab === "detail" && <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{detail ?? "正在读取…"}</pre>}

      {tab === "prefs" && prefs && (
        <div className="space-y-5 text-sm">
          <Row label="节奏">
            <Segment value={prefs.pace ?? "standard"} options={[["slow", "慢热"], ["standard", "标准"], ["direct", "直接"]]} onChange={(v) => update({ pace: v as Prefs["pace"] })} />
          </Row>
          <Row label="尺度">
            <Segment value={prefs.explicitness ?? "standard"} options={[["subtle", "含蓄"], ["standard", "标准"], ["explicit", "直白"]]} onChange={(v) => update({ explicitness: v as Prefs["explicitness"] })} />
          </Row>
          <Row label="人称">
            <Segment value={prefs.person ?? "second"} options={[["second", "你"], ["first", "我"], ["third", "他/她"]]} onChange={(v) => update({ person: v as Prefs["person"] })} />
          </Row>
          <Toggle label="内心可见" hint="正文里能读到配角没说出口的念头，但你的角色并不知道" on={!!prefs.inner_view} onChange={(v) => update({ inner_view: v })} />
          <Toggle label="叙事助手" hint="每回合末尾给 2–3 个可选行动" on={!!prefs.assistant} onChange={(v) => update({ assistant: v })} />
          <Toggle label="离屏推演" hint="不在场的人也在生活；关闭则冻结" on={prefs.offscreen_simulation !== false} onChange={(v) => update({ offscreen_simulation: v })} />
          <div>
            <div className="mb-2 opacity-60">边界：任何时候都不写</div>
            <div className="flex flex-wrap gap-2">
              {safety?.boundaries.map((b, i) => {
                const text = typeof b === "string" ? b : (b.text ?? "");
                return (
                  <button
                    key={`${text}-${i}`}
                    className="rounded-full px-3 py-1 text-xs ring-1 ring-black/10"
                    title="点一下撤销"
                    onClick={() => boundaryOp("remove", { text, ...(typeof b === "object" && b.id ? { boundaryId: b.id } : {}) })}
                  >
                    {text} ×
                  </button>
                );
              })}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = boundary.trim();
                if (!v) return;
                setBoundary("");
                void boundaryOp("add", { text: v.startsWith("不要") ? v : `不要${v}` });
              }}
            >
              <input className="input flex-1" maxLength={60} placeholder="例如：不要涉及怀孕" value={boundary} onChange={(e) => setBoundary(e.target.value)} />
              <button className="btn-ghost shrink-0">添加</button>
            </form>
          </div>
          {safety?.paused && (
            <button
              className="btn-ghost"
              onClick={async () => {
                await call({ action: "pause", paused: false });
                await loadContext();
              }}
            >
              解除暂停
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="opacity-60">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="flex w-full items-center justify-between gap-4 text-left" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span>
        <span className="block">{label}</span>
        <span className="block text-xs opacity-50">{hint}</span>
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-black/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
