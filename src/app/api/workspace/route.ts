import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback, pdfJobs, workspaces } from "@/db/schema";
import { getWorkspace } from "@/lib/workspace";
import { toolIds } from "@/lib/tools";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await getWorkspace();
    const history = await db.select().from(pdfJobs).where(eq(pdfJobs.workspaceId, workspace.id)).orderBy(desc(pdfJobs.createdAt)).limit(50);
    return NextResponse.json({ workspace, history }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Workspace load failed", error);
    return NextResponse.json({ error: "We couldn’t load your workspace. Please try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspace = await getWorkspace();
    const body = await request.json();
    if (body.action === "job") {
      if (!toolIds.includes(body.toolId) || typeof body.fileName !== "string" || !body.fileName.trim() || body.fileName.length > 240 || ![body.inputSize, body.outputSize, body.pageCount].every((n) => Number.isSafeInteger(n) && n >= 0 && n < 2147483647)) {
        return NextResponse.json({ error: "Invalid job details." }, { status: 400 });
      }
      const [job] = await db.insert(pdfJobs).values({ workspaceId: workspace.id, toolId: body.toolId, fileName: body.fileName, inputSize: body.inputSize, outputSize: body.outputSize, pageCount: body.pageCount }).returning();
      return NextResponse.json({ job }, { status: 201 });
    }
    if (body.action === "feedback") {
      if (typeof body.message !== "string" || body.message.trim().length < 10 || body.message.length > 5000) return NextResponse.json({ error: "Please enter a message between 10 and 5,000 characters." }, { status: 400 });
      if (body.email && (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      await db.insert(feedback).values({ workspaceId: workspace.id, message: body.message.trim(), email: body.email || null });
      return NextResponse.json({ success: true }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown workspace action." }, { status: 400 });
  } catch (error) {
    console.error("Workspace save failed", error);
    return NextResponse.json({ error: "Your changes couldn’t be saved. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const workspace = await getWorkspace();
    const body = await request.json();
    if (body.favorites !== undefined && (!Array.isArray(body.favorites) || body.favorites.some((id: unknown) => typeof id !== "string" || !toolIds.includes(id)))) return NextResponse.json({ error: "Invalid favorites." }, { status: 400 });
    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 40)) return NextResponse.json({ error: "Use a workspace name between 1 and 40 characters." }, { status: 400 });
    if (body.name === undefined && body.favorites === undefined) return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
    const [updated] = await db.update(workspaces).set({ ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.favorites !== undefined ? { favorites: body.favorites } : {}) }).where(eq(workspaces.id, workspace.id)).returning();
    return NextResponse.json({ workspace: updated });
  } catch (error) {
    console.error("Workspace update failed", error);
    return NextResponse.json({ error: "Your preferences couldn’t be saved." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const workspace = await getWorkspace();
    const id = request.nextUrl.searchParams.get("id");
    if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid history ID." }, { status: 400 });
    // A workspace can only delete its own records.
    const { and } = await import("drizzle-orm");
    await db.delete(pdfJobs).where(id ? and(eq(pdfJobs.workspaceId, workspace.id), eq(pdfJobs.id, id)) : eq(pdfJobs.workspaceId, workspace.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History deletion failed", error);
    return NextResponse.json({ error: "History couldn’t be cleared." }, { status: 500 });
  }
}
