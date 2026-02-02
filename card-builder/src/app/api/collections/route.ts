import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowToCollection(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cardIds: row.card_ids ? JSON.parse(row.card_ids) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  };
}

export async function GET() {
  const rows = hasUserId.collections
    ? db
        .prepare("SELECT * FROM collections WHERE user_id=? ORDER BY name COLLATE NOCASE")
        .all(DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM collections ORDER BY name COLLATE NOCASE").all();
  return NextResponse.json(rows.map(rowToCollection));
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = data.id ?? crypto.randomUUID();
  const name = data.name;
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const now = Date.now();
  const createdAt = data.createdAt ?? now;
  const updatedAt = data.updatedAt ?? now;
  const schemaVersion = data.schemaVersion ?? 1;
  const cardIds = data.cardIds ?? [];

  if (hasUserId.collections) {
    db.prepare(
      `INSERT OR REPLACE INTO collections (
        id,user_id,name,description,card_ids,created_at,updated_at,schema_version
      ) VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      DEFAULT_USER_ID,
      name,
      data.description ?? null,
      JSON.stringify(cardIds),
      createdAt,
      updatedAt,
      schemaVersion,
    );
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO collections (
        id,name,description,card_ids,created_at,updated_at,schema_version
      ) VALUES (?,?,?,?,?,?,?)`,
    ).run(
      id,
      name,
      data.description ?? null,
      JSON.stringify(cardIds),
      createdAt,
      updatedAt,
      schemaVersion,
    );
  }

  const row = hasUserId.collections
    ? db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM collections WHERE id=?").get(id);
  return NextResponse.json(rowToCollection(row), { status: 201 });
}
