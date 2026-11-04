import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SCENES } from "@/lib/scenes";
import { TopBar } from "@/components/TopBar";
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
    <main>
      <TopBar back="/shelf" title="开新书" />
      <NewBookForm scenes={scenes} adultEnabled={user.adultEnabled} />
    </main>
  );
}
