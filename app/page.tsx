import { AppWorkspace } from "@/components/app-workspace";
import { getDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const db = getDatabase();
  if (db.listConversations().length === 0) db.createConversation();
  return <AppWorkspace initialState={db.getState()} />;
}
