"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Bible } from "@/lib/bible";
import { BibleEditor } from "./BibleEditor";

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
}

type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "done"; chapter: { id: string } }
  | { t: "error"; message: string }
  | { t: "review" }
  | { t: "revising"; issues: string[] }
  | { t: "revised"; v: string };

export function Reader({
  book,
  chapters,
  bible,
  autoStart,
}: {
  book: ReaderBook;
  chapters: ReaderChapter[];
  bible: Bible;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [viewIndex, setViewIndex] = useState(chapters.length - 1);
  const [idea, setIdea] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [phase, setPhase] = useState<"writing" | "review" | "revising">("writing");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<null | "toc" | "bible" | "menu">(null);
  const started = useRef(false);

  const head = chapters.at(-1) ?? null;
  const viewing = chapters[viewIndex] ?? null;
  const isAtHead = viewIndex === chapters.length - 1;
  const finished = book.status === "finished";

  useEffect(() => setViewIndex(chapters.length - 1), [chapters.length, head?.id]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void write(null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function write(parentId: string | null, text: string | null) {
    setError("");
    setPhase("writing");
    setStreaming("");
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch(`/api/books/${book.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, idea: text }),
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
      setIdea("");
      setStreaming(null);
      router.refresh();
    } catch (e) {
      setStreaming(null);
      setError((e as Error).message);
    }
  }

  async function switchBranch(chapterId: string) {
    await api(`/api/books/${book.id}/head`, { body: { chapterId, followLatest: true } });
    router.refresh();
  }

  async function rewriteFrom(c: ReaderChapter) {
    if (!confirm(`回到第${c.index}章，从这里开始写新的分支？原来的后续章节会保留在另一条分支里。`)) return;
    await api(`/api/books/${book.id}/head`, { body: { chapterId: c.id, followLatest: false } });
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

  // ---------- 正在生成 ----------
  if (streaming !== null) {
    const [first, ...rest] = streaming.split("\n");
    return (
      <article className="font-serif">
        <p className="mb-2 text-xs text-ink/40">
          {phase === "writing" && `AI 正在写第 ${chapters.length + 1} 章…`}
          {phase === "review" && "写完了，正在校对剧情是否合理…"}
          {phase === "revising" && "发现了不合理的地方，正在修正…"}
        </p>
        <h2 className="text-2xl font-bold">{rest.length ? first : ""}</h2>
        <div className="mt-4 whitespace-pre-wrap text-lg leading-loose">{rest.length ? rest.join("\n") : first}</div>
        <span className="inline-block h-5 w-2 animate-pulse bg-accent/60" />
      </article>
    );
  }

  // ---------- 还没有章节 ----------
  if (!viewing) {
    return (
      <div className="card space-y-3">
        <p>这本书还没有正文。可以写下你对第一章的想法，也可以直接让 AI 开始。</p>
        <textarea className="input" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="第一章想写什么（可选）" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={() => write(null, idea || null)}>
          写第一章
        </button>
      </div>
    );
  }

  const branchPos = viewing.siblingIds.indexOf(viewing.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <button className="btn-ghost" onClick={() => setPanel(panel === "toc" ? null : "toc")}>目录</button>
        <button className="btn-ghost" onClick={() => setPanel(panel === "bible" ? null : "bible")}>设定集</button>
        <button className="btn-ghost" onClick={() => setPanel(panel === "menu" ? null : "menu")}>更多</button>
        {book.status === "ending" && (
          <span className="self-center text-ink/50">收尾中，还剩 {book.endingLeft} 章</span>
        )}
      </div>

      {panel === "toc" && (
        <ol className="card mb-4 max-h-80 space-y-1 overflow-y-auto">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                className={`w-full text-left ${i === viewIndex ? "text-accent" : ""}`}
                onClick={() => {
                  setViewIndex(i);
                  setPanel(null);
                }}
              >
                第{c.index}章 {c.title}
                {c.siblingIds.length > 1 && <span className="ml-2 text-xs text-ink/40">{c.siblingIds.length} 个分支</span>}
              </button>
            </li>
          ))}
        </ol>
      )}

      {panel === "bible" && <BibleEditor bookId={book.id} bible={bible} onSaved={() => setPanel(null)} />}

      {panel === "menu" && (
        <div className="card mb-4 space-y-2 text-sm">
          {!finished && book.status !== "ending" && (
            <>
              <p className="text-ink/60">什么时候完结由你决定。</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => finish("now")}>下一章就完结</button>
                <button className="btn-ghost" onClick={() => finish("gradual")}>用 3 章慢慢收尾</button>
              </div>
            </>
          )}
          {book.status === "ending" && (
            <button className="btn-ghost" onClick={() => finish("cancel")}>取消收尾，继续连载</button>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <a className="btn-ghost" href={`/api/books/${book.id}/export`}>导出 TXT</a>
            <button className="btn-ghost text-red-600" onClick={remove}>删除这本书</button>
          </div>
        </div>
      )}

      <article className="font-serif">
        <h2 className="text-2xl font-bold">
          第{viewing.index}章 {viewing.title}
        </h2>
        {viewing.idea && <p className="mt-2 text-sm text-ink/50">你的想法：{viewing.idea}</p>}
        <div className="mt-4 whitespace-pre-wrap text-lg leading-loose">{viewing.content}</div>
        <p className="mt-6 text-xs text-ink/40">本章内容由 AI 生成</p>
        {/* 只显示数量：审校意见里可能提到人物的秘密，展示原文会剧透 */}
        {viewing.reviewNotes.length > 0 && (
          <p className="mt-1 text-xs text-ink/40">校对时自动修正了 {viewing.reviewNotes.length} 处不合理的地方</p>
        )}
      </article>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {viewing.siblingIds.length > 1 && (
          <span className="flex items-center gap-1 text-ink/60">
            <button
              className="px-2 disabled:opacity-30"
              disabled={branchPos <= 0}
              onClick={() => switchBranch(viewing.siblingIds[branchPos - 1])}
            >
              ‹
            </button>
            分支 {branchPos + 1}/{viewing.siblingIds.length}
            <button
              className="px-2 disabled:opacity-30"
              disabled={branchPos >= viewing.siblingIds.length - 1}
              onClick={() => switchBranch(viewing.siblingIds[branchPos + 1])}
            >
              ›
            </button>
          </span>
        )}
        {!isAtHead && !finished && (
          <button className="btn-ghost" onClick={() => rewriteFrom(viewing)}>从这一章后改写</button>
        )}
      </div>

      <nav className="mt-6 flex justify-between">
        <button className="btn-ghost" disabled={viewIndex === 0} onClick={() => setViewIndex(viewIndex - 1)}>
          上一章
        </button>
        {!isAtHead && (
          <button className="btn-ghost" onClick={() => setViewIndex(viewIndex + 1)}>下一章</button>
        )}
      </nav>

      {isAtHead && finished && (
        <div className="card mt-6 text-center">
          <p className="font-serif text-xl">全书完</p>
          <p className="mt-1 text-sm text-ink/60">共 {chapters.length} 章</p>
          <button className="btn-ghost mt-3" onClick={reopen}>继续写番外或新卷</button>
        </div>
      )}

      {isAtHead && !finished && head && (
        <section className="card mt-6 space-y-3">
          <h3 className="font-medium">接下来怎么走？</h3>
          {head.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {head.suggestions.map((s) => (
                <button key={s} className="btn-ghost text-left" onClick={() => write(head.id, s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="input"
            rows={3}
            maxLength={500}
            placeholder="写下你的想法，比如：让她发现师兄是卧底"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!idea.trim()} onClick={() => write(head.id, idea)}>
              按我的想法写
            </button>
            <button className="btn-ghost" onClick={() => write(head.id, null)}>
              继续，让 AI 发挥
            </button>
            <button className="btn-ghost" onClick={() => write(head.parentId, head.idea)}>
              重写本章
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
