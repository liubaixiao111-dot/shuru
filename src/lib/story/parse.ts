import { z } from "zod";
import { BibleSchema, type Bible } from "../bible";
import { META_MARKER } from "./prompt";

const MetaSchema = z.object({
  summary: z.string().default(""),
  suggestions: z.array(z.string()).default([]),
  bible: BibleSchema.optional(),
});

export interface ParsedChapter {
  title: string;
  content: string;
  summary: string;
  suggestions: string[];
  bible: Bible | null;
}

/** 拆分模型输出：标题 / 正文 / META JSON。META 解析失败时仍保留正文。 */
export function parseChapter(raw: string, fallbackTitle: string): ParsedChapter {
  const at = raw.indexOf(META_MARKER);
  const body = (at >= 0 ? raw.slice(0, at) : raw).trim();
  const metaRaw = at >= 0 ? raw.slice(at + META_MARKER.length) : "";

  const lines = body.split("\n");
  let title = (lines[0] ?? "").replace(/^#+\s*/, "").replace(/^第.{1,6}章[\s：:]*/, "").trim();
  let content = lines.slice(1).join("\n").trim();
  if (!content || title.length > 30) {
    content = body;
    title = fallbackTitle;
  }

  let summary = "";
  let suggestions: string[] = [];
  let bible: Bible | null = null;
  const jsonMatch = metaRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const meta = MetaSchema.parse(JSON.parse(jsonMatch[0]));
      summary = meta.summary;
      suggestions = meta.suggestions.slice(0, 3);
      bible = meta.bible ?? null;
    } catch {
      // 忽略：正文已保存，摘要退化为开头片段
    }
  }
  if (!summary) summary = content.slice(0, 100);
  return { title: title || fallbackTitle, content, summary, suggestions, bible };
}

/**
 * 流式输出时把 META 部分挡在客户端之外。
 * 由于标记可能被拆在两个分片里，保留末尾不足一个标记长度的内容，等下一片再判断。
 */
export class MarkerSplitter {
  private buf = "";
  private hit = false;

  push(chunk: string): string {
    if (this.hit) return "";
    this.buf += chunk;
    const at = this.buf.indexOf(META_MARKER);
    if (at >= 0) {
      this.hit = true;
      const out = this.buf.slice(0, at);
      this.buf = "";
      return out;
    }
    const keep = META_MARKER.length - 1;
    if (this.buf.length <= keep) return "";
    const out = this.buf.slice(0, this.buf.length - keep);
    this.buf = this.buf.slice(-keep);
    return out;
  }

  flush(): string {
    if (this.hit) return "";
    const out = this.buf;
    this.buf = "";
    return out;
  }
}
