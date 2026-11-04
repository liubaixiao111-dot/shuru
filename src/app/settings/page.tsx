import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROVIDERS } from "@/lib/llm/providers";
import { TopBar } from "@/components/TopBar";
import { SettingsPanel } from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const keys = await prisma.apiKey.findMany({ where: { userId: user.id } });
  const since = new Date(Date.now() - 30 * 86400_000);
  const usage = await prisma.usageLog.groupBy({
    by: ["mode"],
    where: { userId: user.id, createdAt: { gte: since } },
    _sum: { promptTokens: true, completionTokens: true },
    _count: true,
  });

  return (
    <main>
      <TopBar back="/shelf" title="设置" />
      <SettingsPanel
        nickname={user.nickname}
        email={user.email}
        platformTokens={user.platformTokens}
        ageVerified={!!user.ageVerifiedAt}
        adultEnabled={user.adultEnabled}
        providers={Object.values(PROVIDERS).map((p) => ({
          id: p.id,
          name: p.name,
          defaultModel: p.defaultModel,
          keyHint: p.keyHint,
        }))}
        keys={keys.map((k) => ({ provider: k.provider, model: k.model, isDefault: k.isDefault }))}
        usage={usage.map((u) => ({
          mode: u.mode,
          chapters: u._count,
          tokens: (u._sum.promptTokens ?? 0) + (u._sum.completionTokens ?? 0),
        }))}
      />
    </main>
  );
}
