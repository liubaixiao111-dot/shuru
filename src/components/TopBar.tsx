import Link from "next/link";

export function TopBar({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-paper/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {back ? (
          <Link href={back} className="text-ink/60">
            ← 返回
          </Link>
        ) : (
          <Link href="/shelf" className="font-serif text-xl font-bold">
            书入
          </Link>
        )}
        {title && <span className="truncate font-medium">{title}</span>}
      </div>
      <Link href="/settings" className="text-sm text-ink/60">
        设置
      </Link>
    </header>
  );
}
