import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { TabBar } from "@/components/TabBar";
import { AtNewBookForm } from "@/components/AtNewBookForm";

export default async function NewBookPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <main className="pb-28 pt-6">
      <h1 className="text-2xl font-semibold">开一本新书</h1>
      <p className="mt-1 text-sm text-zinc-500">挑一个世界，或者随机开一局。</p>
      <AtNewBookForm adultEnabled={user.adultEnabled} />
      <TabBar />
    </main>
  );
}
