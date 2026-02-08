import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNotes(raw: any) {
  if (typeof raw !== "string") return raw ?? null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // legacy plain text notes
  }
  return raw;
}

function rowToQuest(row: any) {
  return {
    id: row.id,
    title: row.title,
    campaign: row.campaign,
    author: row.author,
    story: row.story,
    notes: parseNotes(row.notes),
    wanderingMonster: row.wandering_monster,
    data: row.data_json ? JSON.parse(row.data_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const row = hasUserId.quests
    ? db.prepare("SELECT * FROM quests WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM quests WHERE id=?").get(params.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rowToQuest(row));
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (hasUserId.quests) {
    db.prepare("DELETE FROM quests WHERE id=? AND user_id=?").run(params.id, DEFAULT_USER_ID);
  } else {
    db.prepare("DELETE FROM quests WHERE id=?").run(params.id);
  }
  return NextResponse.json({ success: true });
}
