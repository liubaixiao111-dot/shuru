"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shelf", label: "书架", icon: "M4 19V5a1 1 0 0 1 1-1h4v16H5a1 1 0 0 1-1-1zM9 4h5v16H9zM14 6l4-1 3 14-4 1z" },
  { href: "/new", label: "开新书", icon: "M12 5v14M5 12h14" },
  { href: "/settings", label: "我的", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

/** 进入阅读前的页面共用的底部导航 */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#0d0d0f]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl justify-around pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-1 px-6 text-[11px] ${active ? "text-white" : "text-zinc-500"}`}
            >
              {t.href === "/new" ? (
                <span className="flex h-8 w-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d={t.icon} />
                  </svg>
                </span>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
