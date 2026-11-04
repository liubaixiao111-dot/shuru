import { prisma } from "../db";
import { HttpError } from "../auth";
import { effectiveBible, parseBible } from "../bible";
import { checkInput } from "../moderation";
import { pathTo } from "../tree";
import { estimateTokens, recordUsage, resolveModels, type ResolvedModel } from "../llm/client";
import { PROVIDERS } from "../llm/providers";
import { buildMessages } from "./prompt";
import { MarkerSplitter, parseChapter } from "./parse";
import { buildFixMessages, buildReviewMessages, parseReview } from "./review";

/** 写后审校默认开启；设置 STORY_REVIEW=off 可关闭（例如压测时） */
function reviewEnabled() {
  return process.env.STORY_REVIEW !== "off";
}

export type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "done"; chapter: { id: string; index: number; title: string; suggestions: string[]; isFinale: boolean } }
  | { t: "error"; message: string }
  /** 正文写完，开始审校 */
  | { t: "review" }
  /** 审校发现问题，正在修正 */
  | { t: "revising"; issues: string[] }
  /** 修正完成，用新的标题和正文替换已显示的内容 */
  | { t: "revised"; v: string };

interface GenerateArgs {
  userId: string;
  bookId: string;
  /** 新章节挂在哪一章之后；null 表示写第一章 */
  parentId: string | null;
  idea: string | null;
}

/** 生成新章节，返回 NDJSON 事件流 */
export async function generateChapter(args: GenerateArgs): Promise<ReadableStream<Uint8Array>> {
  const { userId, bookId, parentId } = args;
  const idea = args.idea?.trim() || null;
  if (idea) {
    if (idea.length > 500) throw new HttpError(400, "想法请控制在 500 字以内");
    const check = checkInput(idea);
    if (!check.ok) throw new HttpError(400, check.reason);
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } });
  if (!book) throw new HttpError(404, "找不到这本书");
  if (book.status === "finished") throw new HttpError(400, "这本书已经完结，可以先选择“继续写番外”");

  // 作者关闭成人向后，已开启成人向的书也按全年龄写
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const adult = book.adult && user.adultEnabled && !!user.ageVerifiedAt;

  const all = await prisma.chapter.findMany({ where: { bookId } });
  if (parentId && !all.some((c) => c.id === parentId)) throw new HttpError(400, "分叉点不存在");
  const history = pathTo(all, parentId);
  const models = await resolveModels(userId);

  const ending = book.status === "ending" && book.endingLeft ? { left: book.endingLeft } : null;
  const bible = parseBible(effectiveBible(book.bible, history.at(-1)?.bible));
  const messages = buildMessages({
    bookTitle: book.title,
    genre: book.genre,
    bible,
    adult,
    history: history.map((c) => ({ index: c.index, title: c.title, summary: c.summary, content: c.content })),
    idea,
    nextIndex: history.length + 1,
    ending,
  });

  const encoder = new TextEncoder();
  const send = (ctl: ReadableStreamDefaultController<Uint8Array>, e: StreamEvent) =>
    ctl.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

  return new ReadableStream({
    async start(ctl) {
      let lastError: unknown = null;
      for (const m of models) {
        let raw = "";
        let emitted = false;
        let usage: { prompt_tokens: number; completion_tokens: number } | null = null;
        try {
          const stream = await m.client.chat.completions.create({
            model: m.model,
            messages,
            stream: true,
            temperature: 0.9,
            ...(PROVIDERS[m.provider].streamUsage ? { stream_options: { include_usage: true } } : {}),
          });
          const splitter = new MarkerSplitter();
          for await (const part of stream) {
            if (part.usage) usage = part.usage;
            const delta = part.choices[0]?.delta?.content ?? "";
            if (!delta) continue;
            raw += delta;
            const out = splitter.push(delta);
            if (out) {
              emitted = true;
              send(ctl, { t: "delta", v: out });
            }
          }
          const tail = splitter.flush();
          if (tail) send(ctl, { t: "delta", v: tail });

          const tokens = {
            prompt: usage?.prompt_tokens ?? estimateTokens(messages.map((x) => x.content).join("")),
            completion: usage?.completion_tokens ?? estimateTokens(raw),
          };

          // 写后审校：发现不合理之处时自动修正一次
          let finalRaw = raw;
          let reviewNotes: string[] = [];
          if (reviewEnabled()) {
            send(ctl, { t: "review" });
            const fixed = await reviewAndFix({
              m,
              messages,
              raw,
              bible,
              recap: history.map((c) => `第${c.index}章 ${c.title}：${c.summary}`),
              idea,
              tokens,
              onRevising: (issues) => send(ctl, { t: "revising", issues }),
            });
            if (fixed) {
              finalRaw = fixed.raw;
              reviewNotes = fixed.issues;
              const p = parseChapter(fixed.raw, `第${history.length + 1}章`);
              send(ctl, { t: "revised", v: `${p.title}\n\n${p.content}` });
            }
          }

          const saved = await saveChapter({
            args: { ...args, idea },
            m,
            raw: finalRaw,
            historyLen: history.length,
            ending,
            reviewNotes,
          });
          await recordUsage({ userId, bookId, m, promptTokens: tokens.prompt, completionTokens: tokens.completion });
          send(ctl, { t: "done", chapter: saved });
          ctl.close();
          return;
        } catch (e) {
          lastError = e;
          console.error(`[generate] ${m.provider} 调用失败`, e);
          // 已经向读者输出了一部分内容时不再切换模型，避免正文拼接错乱
          if (emitted) break;
        }
      }
      send(ctl, {
        t: "error",
        message: lastError instanceof HttpError ? lastError.message : "生成失败了，请稍后重试或检查你的 API Key",
      });
      ctl.close();
    },
  });
}

/**
 * 审校一遍，有实质问题时带着问题清单重写一次。
 * 返回 null 表示无需修正（或审校/修正失败，保留原稿，不影响写作）。
 */
async function reviewAndFix(p: {
  m: ResolvedModel;
  messages: ReturnType<typeof buildMessages>;
  raw: string;
  bible: ReturnType<typeof parseBible>;
  recap: string[];
  idea: string | null;
  tokens: { prompt: number; completion: number };
  onRevising: (issues: string[]) => void;
}): Promise<{ raw: string; issues: string[] } | null> {
  const { m, tokens } = p;
  try {
    const draft = parseChapter(p.raw, "本章");
    const reviewMessages = buildReviewMessages({
      bible: p.bible,
      recap: p.recap,
      idea: p.idea,
      chapter: `${draft.title}\n\n${draft.content}`,
    });
    const review = await m.client.chat.completions.create({
      model: m.model,
      messages: reviewMessages,
      temperature: 0.2,
    });
    const reviewText = review.choices[0]?.message?.content ?? "";
    tokens.prompt += review.usage?.prompt_tokens ?? estimateTokens(reviewMessages.map((x) => x.content).join(""));
    tokens.completion += review.usage?.completion_tokens ?? estimateTokens(reviewText);

    const result = parseReview(reviewText);
    if (result.ok) return null;

    p.onRevising(result.issues);
    const fixMessages = buildFixMessages(p.messages, p.raw, result.issues);
    const fix = await m.client.chat.completions.create({ model: m.model, messages: fixMessages, temperature: 0.8 });
    const fixedRaw = fix.choices[0]?.message?.content ?? "";
    tokens.prompt += fix.usage?.prompt_tokens ?? estimateTokens(fixMessages.map((x) => x.content).join(""));
    tokens.completion += fix.usage?.completion_tokens ?? estimateTokens(fixedRaw);

    // 修正稿明显残缺时放弃，保留原稿
    const fixed = parseChapter(fixedRaw, "本章");
    if (fixed.content.length < draft.content.length * 0.5) return null;
    return { raw: fixedRaw, issues: result.issues };
  } catch (e) {
    console.error("[review] 审校失败，保留原稿", e);
    return null;
  }
}

async function saveChapter(p: {
  args: GenerateArgs;
  m: ResolvedModel;
  raw: string;
  historyLen: number;
  ending: { left: number } | null;
  reviewNotes: string[];
}) {
  const { args, raw, historyLen, ending } = p;
  const index = historyLen + 1;
  const parsed = parseChapter(raw, `第${index}章`);
  const parent = args.parentId ? await prisma.chapter.findUnique({ where: { id: args.parentId } }) : null;
  const book = await prisma.book.findUniqueOrThrow({ where: { id: args.bookId } });
  const bibleSnapshot = parsed.bible ? JSON.stringify(parsed.bible) : effectiveBible(book.bible, parent?.bible);
  const isFinale = ending?.left === 1;

  const chapter = await prisma.chapter.create({
    data: {
      bookId: args.bookId,
      parentId: args.parentId,
      index,
      title: parsed.title,
      content: parsed.content,
      idea: args.idea,
      summary: parsed.summary,
      suggestions: JSON.stringify(isFinale ? [] : parsed.suggestions),
      isFinale,
      bible: bibleSnapshot,
      reviewNotes: JSON.stringify(p.reviewNotes),
    },
  });

  const endingLeft = ending ? ending.left - 1 : null;
  await prisma.book.update({
    where: { id: args.bookId },
    data: {
      headChapterId: chapter.id,
      ...(ending
        ? endingLeft && endingLeft > 0
          ? { endingLeft }
          : { status: "finished", endingLeft: null }
        : {}),
    },
  });

  return {
    id: chapter.id,
    index,
    title: chapter.title,
    suggestions: isFinale ? [] : parsed.suggestions,
    isFinale,
  };
}
