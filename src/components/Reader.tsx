"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PublicBible } from "@/lib/bible";
import type { Mode } from "@/lib/story/modes";
import type { StoryPrefs } from "@/lib/story/prefs";
import { THEMES, useReadingPrefs, type ReadingTheme } from "@/hooks/useReadingPrefs";
import { useSpeech } from "@/hooks/useSpeech";
import { Composer, type ComposerHandle } from "./Composer";
import { StoryPanel } from "./StoryPanel";

export interface ReaderChapter {
  id: string;
  parentId: string | null;
  index: number;
  title: string;
  content: string;
  idea: string | null;
  suggestions: string[];
  isFinale: boolean;
  /** 写后审校自动修正过的问题 */
  reviewNotes: string[];
  /** 同一个分叉点下的所有分支（含自己），按创建顺序 */
  siblingIds: string[];
}

interface ReaderBook {
  id: string;
  title: string;
  status: string;
  endingLeft: number | null;
  adult: boolean;
  lastReadChapterId: string | null;
}

export interface ReaderBookmark {
  chapterId: string;
  excerpt: string;
}

type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "done"; chapter: { id: string } }
  | { t: "error"; message: string }
  | { t: "review" }
  | { t: "revising"; issues: string[] }
  | { t: "revised"; v: string };

type Panel = null | "toc" | "style" | "story" | "menu";

export function Reader({
  book,
  chapters,
  bible,
  bookmarks,
  storyPrefs,
  autoStart,
}: {
  book: ReaderBook;
  chapters: ReaderChapter[];
  bible: PublicBible;
  storyPrefs: StoryPrefs;
  bookmarks: ReaderBookmark[];
  autoStart: boolean;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useReadingPrefs();
  const theme = THEMES[prefs.theme];
  const speech = useSpeech();

  const initialIndex = () => {
    const i = chapters.findIndex((c) => c.id === book.lastReadChapterId);
    return i >= 0 ? i : chapters.length - 1;
  };
  const [viewIndex, setViewIndex] = useState(initialIndex);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [phase, setPhase] = useState<"writing" | "review" | "revising">("writing");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [tocTab, setTocTab] = useState<"toc" | "marks">("toc");
  const started = useRef(false);
  const composer = useRef<ComposerHandle | null>(null);
  const streamTop = useRef<HTMLDivElement>(null);
  /** 新内容接在哪一章后面显示：普通续写接在最新一章后，改写接在上一章后 */
  const [streamAfter, setStreamAfter] = useState<number>(-1);
  const [notice, setNotice] = useState("");
  const lastHead = useRef(chapters.at(-1)?.id);

  const head = chapters.at(-1) ?? null;
  const viewing = chapters[viewIndex] ?? null;
  const isAtHead = viewIndex === chapters.length - 1;
  const finished = book.status === "finished";
  const marked = !!viewing && bookmarks.some((b) => b.chapterId === viewing.id);

  // 阅读页用自己的背景色，离开时还原
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = theme.bg;
    return () => {
      document.body.style.background = prev;
    };
  }, [theme.bg]);

  // 写出新章节或切换分支后，跳到最新一章
  useEffect(() => {
    if (head?.id !== lastHead.current) {
      lastHead.current = head?.id;
      setViewIndex(chapters.length - 1);
    }
  }, [head?.id, chapters.length]);

  // 记录阅读进度
  useEffect(() => {
    if (!viewing) return;
    const t = setTimeout(() => {
      void api(`/api/books/${book.id}/progress`, { body: { chapterId: viewing.id } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [viewing, book.id]);

  // 换章时停止朗读
  useEffect(() => speech.stop, [viewIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void write(null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function go(i: number) {
    setViewIndex(i);
    setPanel(null);
    window.scrollTo({ top: 0 });
  }

  async function write(parentId: string | null, text: string | null, mode: Mode | null = null): Promise<boolean> {
    setError("");
    setNotice("");
    setPhase("writing");
    // 原文留在屏幕上，新内容接在后面写；改写上一段时接在再上一段后面
    const undoing = mode === "rewrite" || /^(刚才|上一段|上面)(的)?不算/.test(text ?? "");
    const base = undoing ? (head?.parentId ?? null) : parentId;
    const after = base ? chapters.findIndex((c) => c.id === base) : -1;
    setStreamAfter(after);
    if (after >= 0) setViewIndex(after);
    setStreaming("");
    setPanel(null);
    requestAnimationFrame(() => streamTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await fetch(`/api/books/${book.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, idea: text, mode }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "生成失败");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.t === "delta") setStreaming((s) => (s ?? "") + ev.v);
          if (ev.t === "review") setPhase("review");
          if (ev.t === "revising") setPhase("revising");
          if (ev.t === "revised") setStreaming(ev.v);
          if (ev.t === "error") throw new Error(ev.message);
        }
      }
      setStreaming(null);
      window.scrollTo({ top: 0 });
      router.refresh();
      return true;
    } catch (e) {
      setStreaming(null);
      setError((e as Error).message);
      return false;
    }
  }

  async function switchBranch(chapterId: string) {
    await api(`/api/books/${book.id}/head`, { body: { chapterId, followLatest: true } });
    router.refresh();
  }

  async function undo() {
    if (!head) return;
    if (!head.parentId) {
      setNotice("第一章不能撤销，可以用“改写上一段”重写它");
      return;
    }
    await api(`/api/books/${book.id}/head`, { body: { chapterId: head.parentId, followLatest: false } });
    setNotice(`已撤销第 ${head.index} 章，原来那段保留在分支里`);
    router.refresh();
  }

  async function setPaused(paused: boolean) {
    await api(`/api/books/${book.id}/prefs`, { method: "PUT", body: { paused } });
    router.refresh();
  }

  async function rewriteFrom(c: ReaderChapter) {
    if (!confirm(`回到第${c.index}章，从这里开始写新的分支？原来的后续章节会保留在另一条分支里。`)) return;
    await api(`/api/books/${book.id}/head`, { body: { chapterId: c.id, followLatest: false } });
    router.refresh();
  }

  async function toggleBookmark() {
    if (!viewing) return;
    if (marked) await api(`/api/books/${book.id}/bookmarks?chapterId=${viewing.id}`, { method: "DELETE" });
    else await api(`/api/books/${book.id}/bookmarks`, { body: { chapterId: viewing.id } });
    router.refresh();
  }

  async function finish(mode: "now" | "gradual" | "cancel") {
    await api(`/api/books/${book.id}/finish`, { body: { mode } });
    setPanel(null);
    router.refresh();
  }

  async function reopen() {
    await api(`/api/books/${book.id}/reopen`, { body: {} });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`确定删除《${book.title}》？所有章节和分支都会删除，无法恢复。`)) return;
    await api(`/api/books/${book.id}`, { method: "DELETE" });
    router.push("/shelf");
    router.refresh();
  }

  const textStyle = {
    fontSize: prefs.fontSize,
    lineHeight: prefs.lineHeight,
    color: theme.fg,
  };
  const fontClass = prefs.font === "serif" ? "font-serif" : "font-sans";
  const toggle = (p: Panel) => setPanel(panel === p ? null : p);
  const writing = streaming !== null;

  // ---------- 顶栏：工具都放在这里，底部留给输入框 ----------
  const topBar = (
    <header
      className="sticky top-0 z-20 -mx-4 flex items-center gap-1 px-2 py-2 backdrop-blur"
      style={{ background: `${theme.bg}e6`, color: theme.muted }}
    >
      <Link href="/shelf" className="p-2" aria-label="返回书架">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <span className="min-w-0 flex-1 truncate text-sm">{book.title}</span>
      {!writing && (
        <>
          <IconButton label="目录" active={panel === "toc"} onClick={() => toggle("toc")} icon="M4 6h16M4 12h16M4 18h10" />
          <IconButton label="故事状态与写法" active={panel === "story"} onClick={() => toggle("story")} icon="M9 7a3 3 0 1 0 0 .01M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6" />
          <IconButton label="字体与背景" active={panel === "style"} onClick={() => toggle("style")} icon="M4 20l6-16 6 16M6.5 14h7M17 20l2.5-7 2.5 7" />
          {speech.supported && viewing && (
            <IconButton
              label={speech.speaking ? "停止朗读" : "听书"}
              active={speech.speaking}
              onClick={() => (speech.speaking ? speech.stop() : speech.speak(`${viewing.title}\n${viewing.content}`))}
              icon={speech.speaking ? "M7 6h3v12H7zM14 6h3v12h-3z" : "M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"}
            />
          )}
          {viewing && (
            <button onClick={toggleBookmark} aria-label={marked ? "取消书签" : "加书签"} className="p-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill={marked ? "#b4532a" : "none"} stroke={marked ? "#b4532a" : "currentColor"} strokeWidth="2">
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
            </button>
          )}
          <IconButton label="更多" active={panel === "menu"} onClick={() => toggle("menu")} icon="M5 12h.01M12 12h.01M19 12h.01" />
        </>
      )}
    </header>
  );

  const prevTail = (i: number) => {
    // 章首带上一章的最后几句，接着读不用往回翻
    const prev = chapters[i - 1];
    if (!prev) return null;
    const tail = prev.content.trim().slice(-160);
    return (
      <button
        className="mb-4 block w-full rounded-xl px-4 py-3 text-left text-sm leading-relaxed"
        style={{ background: theme.card, color: theme.muted }}
        onClick={() => go(i - 1)}
      >
        <span className="mb-1 block text-xs">接上一章 · {prev.title}</span>……{tail.replace(/^[^。！？”\n]*[。！？”\n]/, "")}
      </button>
    );
  };

  // ---------- 还没有章节 ----------
  if (!viewing && !writing) {
    return (
      <div className="-mx-4 min-h-screen px-4 pb-40" style={{ background: theme.bg }}>
        {topBar}
        <p className="mt-10 text-center text-sm" style={{ color: theme.muted }}>
          这本书还没有正文。写下你想怎么开头，或者直接点发送旁边的“继续”交给 AI。
        </p>
        <Composer
          bookId={book.id}
          suggestions={[]}
          assistant={false}
          busy={false}
          error={error}
          paused={false}
          onWrite={(t, m) => write(null, t, m)}
          colors={theme}
        />
      </div>
    );
  }

  const branchPos = viewing ? viewing.siblingIds.indexOf(viewing.id) : 0;
  const words = chapters.reduce((n, c) => n + c.content.length, 0);
  const atEnd = isAtHead && !writing;
  const showComposer = !finished && (atEnd || writing);
  const [sFirst, ...sRest] = (streaming ?? "").split("\n");

  return (
    <div className={`-mx-4 min-h-screen px-4 ${showComposer ? "pb-44" : "pb-16"}`} style={{ background: theme.bg }}>
      {topBar}

      {viewing && (!writing || streamAfter >= 0) && (
        <article className={fontClass}>
          {prevTail(viewIndex)}
          <h2 className="mt-2 text-2xl font-bold leading-snug" style={{ color: theme.fg }}>
            {viewing.title}
          </h2>
          <p className="mt-2 text-xs" style={{ color: theme.muted }}>
            第 {viewing.index} 章 · {viewing.content.length} 字
            {viewing.idea && ` · 你：${viewing.idea}`}
          </p>
          <div className="mt-6 whitespace-pre-wrap" style={textStyle}>
            {viewing.content}
          </div>
          {!writing && (
            <p className="mt-8 text-xs" style={{ color: theme.muted }}>
              本章内容由 AI 生成
              {/* 只显示数量：审校意见里可能提到人物的秘密，展示原文会剧透 */}
              {viewing.reviewNotes.length > 0 && ` · 校对时自动修正了 ${viewing.reviewNotes.length} 处不合理的地方`}
            </p>
          )}
        </article>
      )}

      {writing && (
        <article className={`${fontClass} mt-10`} ref={streamTop}>
          <div className="mb-6 flex items-center gap-3 text-xs" style={{ color: theme.muted }}>
            <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.3 }} />
            {phase === "writing" && "正在往下写…"}
            {phase === "review" && "写完了，正在校对剧情是否合理…"}
            {phase === "revising" && "发现了不合理的地方，正在修正…"}
            <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.3 }} />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: theme.fg }}>
            {sRest.length ? sFirst : ""}
          </h2>
          <div className="mt-5 whitespace-pre-wrap" style={textStyle}>
            {sRest.length ? sRest.join("\n") : sFirst}
            <span className="ml-1 inline-block h-5 w-1.5 animate-pulse bg-accent/60 align-middle" />
          </div>
        </article>
      )}

      {viewing && !writing && (
        <>
          {atEnd && storyPrefs.assistant && head && head.suggestions.length > 0 && !finished && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs" style={{ color: theme.muted }}>
              <span>可以：</span>
              {head.suggestions.map((s, i) => (
                <button key={s} className="rounded-full border border-current px-3 py-1" onClick={() => composer.current?.fill(s)}>
                  {"①②③"[i]} {s}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs" style={{ color: theme.muted }}>
            {viewing.siblingIds.length > 1 && (
              <span className="flex items-center gap-1">
                <button className="px-1 disabled:opacity-30" disabled={branchPos <= 0} onClick={() => switchBranch(viewing.siblingIds[branchPos - 1])}>
                  ‹
                </button>
                分支 {branchPos + 1}/{viewing.siblingIds.length}
                <button
                  className="px-1 disabled:opacity-30"
                  disabled={branchPos >= viewing.siblingIds.length - 1}
                  onClick={() => switchBranch(viewing.siblingIds[branchPos + 1])}
                >
                  ›
                </button>
              </span>
            )}
            {!isAtHead && !finished && <button onClick={() => rewriteFrom(viewing)}>从这一章后改写</button>}
            {atEnd && !finished && head && (
              <button onClick={() => write(head.parentId, head.idea, null)}>不满意，重写这一章</button>
            )}
            {notice && <span>{notice}</span>}
          </div>

          <nav className="mt-6 flex justify-between gap-3">
            <button
              className="flex-1 rounded-full py-2 text-sm ring-1 ring-black/10 disabled:opacity-30"
              style={{ color: theme.fg }}
              disabled={viewIndex === 0}
              onClick={() => go(viewIndex - 1)}
            >
              上一章
            </button>
            <button
              className="flex-1 rounded-full py-2 text-sm ring-1 ring-black/10 disabled:opacity-30"
              style={{ color: theme.fg }}
              disabled={isAtHead}
              onClick={() => go(viewIndex + 1)}
            >
              {isAtHead ? "已是最新" : "下一章"}
            </button>
          </nav>
          {!isAtHead && !finished && (
            <button className="mt-3 w-full text-center text-xs" style={{ color: theme.muted }} onClick={() => go(chapters.length - 1)}>
              跳到最新一章，接着写 ›
            </button>
          )}

          {isAtHead && finished && (
            <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: theme.card, color: theme.fg }}>
              <p className="font-serif text-xl">全书完</p>
              <p className="mt-1 text-sm" style={{ color: theme.muted }}>
                共 {chapters.length} 章 · {words.toLocaleString()} 字
              </p>
              <button className="mt-4 rounded-full px-5 py-2 text-sm ring-1 ring-black/10" onClick={reopen}>
                继续写番外或新卷
              </button>
            </div>
          )}
        </>
      )}

      {showComposer && (
        <Composer
          bookId={book.id}
          suggestions={head?.suggestions ?? []}
          assistant={storyPrefs.assistant}
          busy={writing}
          error={error}
          paused={storyPrefs.paused}
          onWrite={(t, m) => write(head?.id ?? null, t, m)}
          onUndo={head ? undo : undefined}
          onPause={setPaused}
          colors={theme}
          bind={(h) => (composer.current = h)}
        />
      )}

      {panel && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setPanel(null)} />
          <div
            className={`reader-sheet ${prefs.theme === "night" ? "night" : ""} fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[80vh] max-w-2xl overflow-y-auto rounded-t-3xl p-5 pb-8 shadow-2xl`}
            style={{ background: prefs.theme === "night" ? "#1c1c1c" : "#fff", color: prefs.theme === "night" ? theme.fg : "#2b2622" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />

            {panel === "toc" && (
              <div>
                <div className="mb-3 flex gap-4 text-sm">
                  <button className={tocTab === "toc" ? "font-semibold text-accent" : "opacity-60"} onClick={() => setTocTab("toc")}>
                    目录 · {chapters.length} 章
                  </button>
                  <button className={tocTab === "marks" ? "font-semibold text-accent" : "opacity-60"} onClick={() => setTocTab("marks")}>
                    书签 · {bookmarks.length}
                  </button>
                </div>
                {tocTab === "toc" ? (
                  <ol className="space-y-1">
                    {chapters.map((c, i) => (
                      <li key={c.id}>
                        <button className={`w-full py-1.5 text-left text-sm ${i === viewIndex ? "text-accent" : ""}`} onClick={() => go(i)}>
                          第{c.index}章 {c.title}
                          {c.siblingIds.length > 1 && <span className="ml-2 text-xs opacity-40">{c.siblingIds.length} 个分支</span>}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : bookmarks.length === 0 ? (
                  <p className="py-6 text-center text-sm opacity-50">还没有书签，点右上角的书签图标添加</p>
                ) : (
                  <ul className="space-y-2">
                    {bookmarks.map((b) => {
                      const i = chapters.findIndex((c) => c.id === b.chapterId);
                      const c = chapters[i];
                      return (
                        <li key={b.chapterId}>
                          <button className="w-full text-left disabled:opacity-40" disabled={i < 0} onClick={() => go(i)}>
                            <div className="text-sm">{c ? `第${c.index}章 ${c.title}` : "（在另一条分支上）"}</div>
                            <div className="truncate text-xs opacity-50">{b.excerpt}…</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {panel === "style" && (
              <div className="space-y-5 text-sm">
                <Row label="字号">
                  <Stepper value={prefs.fontSize} min={14} max={28} step={1} onChange={(v) => setPrefs({ fontSize: v })} />
                </Row>
                <Row label="行距">
                  <Stepper value={prefs.lineHeight} min={1.5} max={2.6} step={0.1} onChange={(v) => setPrefs({ lineHeight: Math.round(v * 10) / 10 })} />
                </Row>
                <Row label="字体">
                  <Segment
                    options={[
                      ["serif", "宋体"],
                      ["sans", "黑体"],
                    ]}
                    value={prefs.font}
                    onChange={(v) => setPrefs({ font: v as "serif" | "sans" })}
                  />
                </Row>
                <Row label="背景">
                  <div className="flex gap-3">
                    {(Object.keys(THEMES) as ReadingTheme[]).map((k) => (
                      <button
                        key={k}
                        aria-label={THEMES[k].name}
                        onClick={() => setPrefs({ theme: k })}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] ring-2 ${prefs.theme === k ? "ring-accent" : "ring-black/10"}`}
                        style={{ background: THEMES[k].bg, color: THEMES[k].fg }}
                      >
                        {THEMES[k].name.slice(0, 1)}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
            )}

            {panel === "story" && (
              <StoryPanel
                bookId={book.id}
                bible={bible}
                prefs={storyPrefs}
                suggestions={finished ? [] : (head?.suggestions ?? [])}
                onClose={() => setPanel(null)}
                onPick={(s) => {
                  setPanel(null);
                  if (!isAtHead) go(chapters.length - 1);
                  requestAnimationFrame(() => composer.current?.fill(s));
                }}
              />
            )}

            {panel === "menu" && (
              <div className="space-y-4 text-sm">
                <p className="opacity-60">
                  共 {chapters.length} 章 · {words.toLocaleString()} 字
                  {book.status === "ending" && ` · 收尾中，还剩 ${book.endingLeft} 章`}
                </p>
                {!finished && book.status !== "ending" && (
                  <div>
                    <p className="mb-2 opacity-60">什么时候完结由你决定</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-ghost" onClick={() => finish("now")}>下一章就完结</button>
                      <button className="btn-ghost" onClick={() => finish("gradual")}>用 3 章慢慢收尾</button>
                    </div>
                  </div>
                )}
                {book.status === "ending" && (
                  <button className="btn-ghost" onClick={() => finish("cancel")}>取消收尾，继续连载</button>
                )}
                <div className="flex flex-wrap gap-2 border-t border-black/5 pt-4">
                  <a className="btn-ghost" href={`/api/books/${book.id}/export`}>导出 TXT</a>
                  <button className="btn-ghost text-red-600" onClick={remove}>删除这本书</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IconButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`p-2 ${active ? "text-accent" : ""}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="opacity-60">{label}</span>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button className="h-8 w-10 rounded-full ring-1 ring-black/10 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        A-
      </button>
      <span className="w-10 text-center tabular-nums">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
      <button className="h-8 w-10 rounded-full ring-1 ring-black/10 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        A+
      </button>
    </div>
  );
}

function Segment({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-full p-1 ring-1 ring-black/10">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-4 py-1 ${value === v ? "bg-accent text-white" : ""}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
