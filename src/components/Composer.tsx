"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { Mode } from "@/lib/story/modes";

export interface ComposerHandle {
  fill: (text: string) => void;
}

interface Props {
  bookId: string;
  suggestions: string[];
  /** 叙事助手开启时，推荐行动已经显示在正文末尾，这里不再重复 */
  assistant: boolean;
  busy: boolean;
  error: string;
  paused: boolean;
  /** 还没有正文时只保留输入框 */
  bare?: boolean;
  onWrite: (idea: string | null, mode: Mode | null) => Promise<boolean>;
  onUndo?: () => void;
  onPause?: (paused: boolean) => void;
  colors: { bg: string; fg: string; muted: string; card: string };
  /** 让外部（正文末尾的推荐行动）可以把文字填进输入框 */
  bind?: (h: ComposerHandle) => void;
}

const DRAFT_KEY = (id: string) => `shuru.draft.${id}`;

const SKIPS = ["到晚上", "到明天早上", "三天后", "一周后"];

/**
 * 续写区：贴在屏幕底部的一条输入框，尽量少挡正文。
 * 作者自己写为主；常用的推进方式做成一排小按钮（继续、等一等、其实、改写、撤销、快进、转折、暂停）。
 * 草稿自动存在本机，刷新或退出不会丢，写成功才清掉。
 */
export function Composer(p: Props) {
  const { bookId, busy, colors } = p;
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [tray, setTray] = useState<null | "ideas" | "skip">(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(DRAFT_KEY(bookId)) ?? "");
    } catch {
      // 忽略
    }
  }, [bookId]);

  // 输入框随内容长高，最多五行
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text, interim]);

  function save(v: string) {
    setText(v);
    try {
      if (v) localStorage.setItem(DRAFT_KEY(bookId), v);
      else localStorage.removeItem(DRAFT_KEY(bookId));
    } catch {
      // 忽略
    }
  }

  function fill(v: string) {
    save(v);
    setTray(null);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(v.length, v.length);
    });
  }

  useEffect(() => {
    p.bind?.({ fill });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const voice = useVoiceInput((t, final) => {
    if (final) {
      setInterim("");
      save((text ? text : "") + t);
    } else {
      setInterim(t);
    }
  });

  async function submit(v: string | null, mode: Mode | null = null) {
    if (voice.listening) voice.stop();
    setTray(null);
    // 写成功才清掉草稿，失败时作者的字还在
    if ((await p.onWrite(v, mode)) && v === text.trim()) save("");
  }

  const chip = "shrink-0 whitespace-nowrap rounded-full border border-current px-3 py-1 text-xs disabled:opacity-40";
  const chipStyle = { color: colors.muted };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 backdrop-blur"
      style={{ background: `${colors.bg}f2` }}
    >
      <div className="mx-auto max-w-2xl px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
        {p.paused && (
          <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background: colors.card, color: colors.muted }}>
            <span>已暂停。下一段不会接着刚才的场面写。</span>
            <button className="underline" onClick={() => p.onPause?.(false)}>
              取消暂停
            </button>
          </div>
        )}
        {p.error && <p className="mb-1 px-1 text-xs text-red-600">{p.error}</p>}

        {tray === "ideas" && p.suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {p.suggestions.map((s) => (
              <button key={s} className={chip} style={chipStyle} onClick={() => fill(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {tray === "skip" && (
          <div className="mb-2 flex flex-wrap gap-2">
            {SKIPS.map((s) => (
              <button key={s} className={chip} style={chipStyle} disabled={busy} onClick={() => submit(`快进${s}`, "skip")}>
                快进{s}
              </button>
            ))}
          </div>
        )}

        {!p.bare && (
          <div className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            <button className={chip} style={chipStyle} disabled={busy} onClick={() => submit(null, "continue")} title="让场景自然往前走">
              继续
            </button>
            <button
              className={chip}
              style={chipStyle}
              disabled={busy}
              onClick={() => submit(text.trim() || "我不说话，看看对方怎么做", "wait")}
              title="按兵不动，把空间留给别人"
            >
              等一等
            </button>
            <button className={chip} style={chipStyle} disabled={busy} onClick={() => fill("其实")} title="补一条过去就成立的事">
              其实…
            </button>
            <button className={chip} style={chipStyle} disabled={busy} onClick={() => fill("刚才不算，改成")} title="撤掉上一段，按新的想法重写">
              改写上一段
            </button>
            {p.onUndo && (
              <button className={chip} style={chipStyle} disabled={busy} onClick={p.onUndo} title="回到上一段，原来这段保留在分支里">
                撤销
              </button>
            )}
            <button className={chip} style={chipStyle} disabled={busy} onClick={() => setTray(tray === "skip" ? null : "skip")}>
              快进
            </button>
            <button className={chip} style={chipStyle} disabled={busy} onClick={() => submit(text.trim() || null, "twist")}>
              来点转折
            </button>
            {!p.assistant && p.suggestions.length > 0 && (
              <button className={chip} style={chipStyle} disabled={busy} onClick={() => setTray(tray === "ideas" ? null : "ideas")}>
                没灵感？
              </button>
            )}
            {p.onPause && !p.paused && (
              <button className={chip} style={chipStyle} disabled={busy} onClick={() => p.onPause?.(true)} title="不想继续刚才的场面">
                暂停
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label={voice.listening ? "停止语音输入" : "语音输入"}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={busy}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
              voice.listening ? "animate-pulse bg-red-500 text-white" : ""
            }`}
            style={voice.listening ? undefined : { background: colors.card, color: colors.fg }}
          >
            <MicIcon />
          </button>
          <textarea
            ref={area}
            className="block max-h-[132px] min-h-10 flex-1 resize-none rounded-2xl px-4 py-2 text-[15px] leading-6 outline-none placeholder:opacity-50"
            style={{ background: colors.card, color: colors.fg }}
            rows={1}
            maxLength={500}
            placeholder={voice.listening ? "正在听，说完点一下停止" : "你接下来做什么、说什么？"}
            value={interim ? text + interim : text}
            onChange={(e) => save(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) void submit(text.trim());
            }}
            disabled={busy}
          />
          <button
            type="button"
            aria-label="续写"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-30"
            disabled={busy || !text.trim()}
            onClick={() => submit(text.trim())}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        {voice.error && <p className="mt-1 px-1 text-xs" style={{ color: colors.muted }}>{voice.error}</p>}
      </div>
    </div>
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
