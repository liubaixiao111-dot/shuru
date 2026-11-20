import { coverGradient } from "@/lib/covers";

/** 渐变封面：书名 + 题材角标，不需要图片资源 */
export function BookCover({ title, genre, className = "" }: { title: string; genre: string; className?: string }) {
  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg shadow-black/40 ${className}`}
      style={{ background: coverGradient(genre, title) }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.18),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
      <div className="absolute inset-x-0 top-0 p-3">
        <div className="mb-2 h-0.5 w-6 rounded bg-white/70" />
        <p className="line-clamp-3 break-all text-[15px] font-bold leading-snug tracking-wide text-white">{title}</p>
      </div>
      <span className="absolute bottom-2 left-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
        {genre}
      </span>
    </div>
  );
}
