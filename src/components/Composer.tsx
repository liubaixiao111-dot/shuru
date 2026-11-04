"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Props {
  bookId: string;
  suggestions: string[];
  busy: boolean;
  error: string;
  onWrite: (idea: string | null) => Promise<boolean>;
  /** 没有传就不显示“重写本章” */
  onRewrite?: () => void;
  colors: { fg: string; muted: string; card: string };
}

const DRAFT_KEY = (id: string) => `shuru.draft.${id}`;

/**
 * 续写区：以作者自己写为主。推荐走向默认收起，只作为“没灵感时”的辅助。
 * 草稿自动存在本机，刷新或退出不会丢。
 */
export function Composer({ bookId, suggestions, busy, error, onWrite, onRewrite, colors }: Props) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [showIdeas, setShowIdeas] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(DRAFT_KEY(bookId)) ?? "");
    } catch {
      // 忽略
    }
  }, [bookId]);

  function save(v: string) {
    setText(v);
    try {
      if (v) localStorage.setItem(DRAFT_KEY(bookId), v);
      else localStorage.removeItem(DRAFT_KEY(bookId));
    } catch {
      // 忽略
    }
  }

  const voice = useVoiceInput((t, final) => {
    if (final) {
      setInterim("");
      save((text ? text : "") + t);
    } else {
      setInterim(t);
    }
  });

  async function submit(v: string | null) {
    if (voice.listening) voice.stop();
    // 写成功才清掉草稿，失败时作者的字还在
    if ((await onWrite(v)) && v) save("");
  }

  return (
    <section className="mt-10">
      <div className="rounded-2xl p-3 shadow-sm ring-1 ring-black/5" style={{ background: colors.card }}>
        <textarea
          ref={area}
          className="block w-full resize-none bg-transparent px-1 py-1 text-base leading-relaxed outline-none placeholder:opacity-50"
          style={{ color: colors.fg }}
          rows={3}
          maxLength={500}
          placeholder="接下来，你想让故事怎么走？"
          value={interim ? text + interim : text}
          onChange={(e) => save(e.target.value)}
          disabled={busy}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={voice.listening ? "停止语音输入" : "语音输入"}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={busy}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
              voice.listening ? "animate-pulse bg-red-500 text-white" : "bg-black/5"
            }`}
            style={voice.listening ? undefined : { color: colors.fg }}
          >
            <MicIcon />
          </button>
          <span className="flex-1 truncate text-xs" style={{ color: colors.muted }}>
            {voice.listening ? "正在听，说完点一下停止" : voice.error || `${text.length}/500`}
          </span>
          <button
            type="button"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={busy || !text.trim()}
            onClick={() => submit(text.trim())}
          >
            续写
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: colors.muted }}>
        {suggestions.length > 0 && (
          <button type="button" onClick={() => setShowIdeas(!showIdeas)} disabled={busy}>
            {showIdeas ? "收起灵感" : "没灵感？"}
          </button>
        )}
        <button type="button" onClick={() => submit(null)} disabled={busy}>
          交给 AI 往下写
        </button>
        {onRewrite && (
          <button type="button" onClick={onRewrite} disabled={busy}>
            重写本章
          </button>
        )}
      </div>
      {showIdeas && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full px-3 py-1 text-xs ring-1 ring-black/10"
              style={{ color: colors.muted }}
              onClick={() => {
                save(s);
                setShowIdeas(false);
                area.current?.focus();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
