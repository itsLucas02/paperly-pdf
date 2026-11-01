import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";

export async function getWorkspace() {
  const store = await cookies();
  const existing = store.get("paperly-workspace")?.value;
  const id = existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing) ? existing : randomUUID();
  if (!existing || id !== existing) {
    store.set("paperly-workspace", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  await db.insert(workspaces).values({ id }).onConflictDoNothing();
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return workspace;
}
