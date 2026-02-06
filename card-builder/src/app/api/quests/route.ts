import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowToQuest(row: any) {
  return {
    id: row.id,
    title: row.title,
    campaign: row.campaign,
    author: row.author,
    story: row.story,
    notes: row.notes,
    wanderingMonster: row.wandering_monster,
    data: row.data_json ? JSON.parse(row.data_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const rows = hasUserId.quests
    ? db.prepare("SELECT * FROM quests WHERE user_id=? ORDER BY updated_at DESC").all(DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM quests ORDER BY updated_at DESC").all();
  return NextResponse.json(rows.map(rowToQuest));
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = data.id ?? crypto.randomUUID();
  const now = Date.now();
  const createdAt = data.createdAt ?? now;
  const updatedAt = data.updatedAt ?? now;
  const dataJson = JSON.stringify(data.data ?? {});

  if (hasUserId.quests) {
    db.prepare(
      `INSERT OR REPLACE INTO quests (
        id,user_id,title,campaign,author,story,notes,wandering_monster,data_json,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      DEFAULT_USER_ID,
      data.title ?? null,
      data.campaign ?? null,
      data.author ?? null,
      data.story ?? null,
      data.notes ?? null,
      data.wanderingMonster ?? null,
      dataJson,
      createdAt,
      updatedAt,
    );
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO quests (
        id,title,campaign,author,story,notes,wandering_monster,data_json,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      data.title ?? null,
      data.campaign ?? null,
      data.author ?? null,
      data.story ?? null,
      data.notes ?? null,
      data.wanderingMonster ?? null,
      dataJson,
      createdAt,
      updatedAt,
    );
  }

  const row = hasUserId.quests
    ? db.prepare("SELECT * FROM quests WHERE id=? AND user_id=?").get(id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM quests WHERE id=?").get(id);
  return NextResponse.json(rowToQuest(row), { status: 201 });
}
