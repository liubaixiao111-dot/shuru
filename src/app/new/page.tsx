import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SCENES } from "@/lib/scenes";
import { TabBar } from "@/components/TabBar";
import { NewBookForm } from "@/components/NewBookForm";

export default async function NewBookPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const scenes = SCENES.map(({ id, genre, name, hook, defaultTitle, protagonistName, questions }) => ({
    id,
    genre,
    name,
    hook,
    defaultTitle,
    protagonistName,
    questions: questions ?? null,
  }));
  return (
    <main className="pb-28 pt-6">
      <h1 className="text-2xl font-semibold">开一本新书</h1>
      <p className="mt-1 text-sm text-zinc-500">选一个开场，或者写下你自己的设定。</p>
      <NewBookForm scenes={scenes} adultEnabled={user.adultEnabled} />
      <TabBar />
    </main>
  );
}
