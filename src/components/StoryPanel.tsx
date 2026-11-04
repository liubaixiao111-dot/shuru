"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { PublicBible } from "@/lib/bible";
import type { StoryPrefs } from "@/lib/story/prefs";
import { BibleEditor } from "./BibleEditor";

type Tab = "state" | "prefs" | "bible";

/**
 * 故事面板：状态（六行人话，不露数值）、写法偏好、设定集。
 */
export function StoryPanel({
  bookId,
  bible,
  prefs,
  suggestions,
  onClose,
  onPick,
}: {
  bookId: string;
  bible: PublicBible;
  prefs: StoryPrefs;
  suggestions: string[];
  onClose: () => void;
  onPick: (s: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("state");
  return (
    <div>
      <div className="mb-4 flex gap-5 text-sm">
        {(
          [
            ["state", "状态"],
            ["prefs", "写法"],
            ["bible", "设定集"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "font-semibold text-accent" : "opacity-60"} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "state" && <StateView bible={bible} prefs={prefs} suggestions={suggestions} onPick={onPick} />}
      {tab === "prefs" && <PrefsView bookId={bookId} prefs={prefs} />}
      {tab === "bible" && <BibleEditor bookId={bookId} bible={bible} onSaved={onClose} />}
    </div>
  );
}

function StateView({
  bible,
  prefs,
  suggestions,
  onPick,
}: {
  bible: PublicBible;
  prefs: StoryPrefs;
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  const present = bible.characters.filter((c) => c.present);
  const bonds = bible.characters.filter((c) => c.bond);
  const when = [bible.state.time, bible.state.place].filter(Boolean).join(" · ");
  return (
    <dl className="space-y-4 text-sm">
      <Line label="此刻">{when || "还没有记录"}</Line>
      <Line label="在场">
        {present.length ? present.map((c) => `${c.name}（${c.desc}）`).join("；") : "只有你，或者还没有记录"}
      </Line>
      <Line label="关系">
        {bonds.length ? (
          <ul className="space-y-1">
            {bonds.map((c) => (
              <li key={c.name}>
                <span className="font-medium">{c.name}</span>：{c.bond}
              </li>
            ))}
          </ul>
        ) : (
          "还没有和谁真正打过交道"
        )}
      </Line>
      <Line label="悬而未决">
        {bible.state.threads.length ? (
          <ul className="list-inside list-disc space-y-0.5">
            {bible.state.threads.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          "暂时没有"
        )}
      </Line>
      <Line label="边界">
        {prefs.boundaries.length ? prefs.boundaries.map((b) => `不要${b}`).join("；") : "没有设边界，可以在“写法”里添加"}
        {prefs.paused && " · 已暂停"}
      </Line>
      {suggestions.length > 0 && (
        <Line label="可以">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} className="rounded-full px-3 py-1 text-xs ring-1 ring-black/10" onClick={() => onPick(s)}>
                {s}
              </button>
            ))}
          </div>
        </Line>
      )}
    </dl>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-14 shrink-0 opacity-50">{label}</dt>
      <dd className="flex-1 leading-relaxed">{children}</dd>
    </div>
  );
}

function PrefsView({ bookId, prefs }: { bookId: string; prefs: StoryPrefs }) {
  const router = useRouter();
  const [local, setLocal] = useState(prefs);
  const [boundary, setBoundary] = useState("");
  const [error, setError] = useState("");

  async function update(patch: Partial<StoryPrefs>) {
    setError("");
    const prev = local;
    setLocal({ ...local, ...patch });
    try {
      await api(`/api/books/${bookId}/prefs`, { method: "PUT", body: patch });
      router.refresh();
    } catch (e) {
      setLocal(prev);
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <p className="text-xs opacity-50">只影响写法，从下一段开始生效。人物的意志和关系慢热不会因此改变。</p>
      <Row label="节奏">
        <Segment
          value={local.pace}
          options={[
            ["slow", "慢热"],
            ["standard", "标准"],
            ["direct", "直接"],
          ]}
          onChange={(v) => update({ pace: v as StoryPrefs["pace"] })}
        />
      </Row>
      <Row label="基调">
        <Segment
          value={local.tone}
          options={[
            ["pressure", "有压力"],
            ["daily", "日常"],
          ]}
          onChange={(v) => update({ tone: v as StoryPrefs["tone"] })}
        />
      </Row>
      <Row label="人称">
        <Segment
          value={local.person}
          options={[
            ["third", "他/她"],
            ["second", "你"],
          ]}
          onChange={(v) => update({ person: v as StoryPrefs["person"] })}
        />
      </Row>
      <Toggle label="内心可见" hint="正文里能读到配角没说出口的念头，但主角并不知道" on={local.innerView} onChange={(v) => update({ innerView: v })} />
      <Toggle label="叙事助手" hint="每段末尾直接给出 2–3 个可以做的事" on={local.assistant} onChange={(v) => update({ assistant: v })} />
      <Toggle label="离屏推演" hint="不在场的人也在按自己的打算行动；关闭则冻结" on={local.offscreen} onChange={(v) => update({ offscreen: v })} />
      <div>
        <div className="mb-2 opacity-60">边界：任何时候都不写</div>
        <div className="flex flex-wrap gap-2">
          {local.boundaries.map((b) => (
            <button
              key={b}
              className="rounded-full px-3 py-1 text-xs ring-1 ring-black/10"
              onClick={() => update({ boundaries: local.boundaries.filter((x) => x !== b) })}
              title="点一下删除"
            >
              不要{b} ×
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = boundary.trim().replace(/^不要/, "");
            if (!v) return;
            setBoundary("");
            void update({ boundaries: [...local.boundaries, v] });
          }}
        >
          <input className="input flex-1" maxLength={60} placeholder="例如：动物受伤" value={boundary} onChange={(e) => setBoundary(e.target.value)} />
          <button className="btn-ghost shrink-0">添加</button>
        </form>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
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

export function Segment({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-full p-1 ring-1 ring-black/10">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-3 py-1 ${value === v ? "bg-accent text-white" : ""}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
