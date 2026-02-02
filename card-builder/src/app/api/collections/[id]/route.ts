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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const data = await request.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = hasUserId.collections
    ? db.prepare("SELECT id FROM collections WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT id FROM collections WHERE id=?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const paramsList: any[] = [];

  if ("name" in data) {
    updates.push("name=?");
    paramsList.push(data.name);
  }
  if ("description" in data) {
    updates.push("description=?");
    paramsList.push(data.description ?? null);
  }
  if ("cardIds" in data) {
    updates.push("card_ids=?");
    paramsList.push(JSON.stringify(data.cardIds ?? []));
  }
  if ("schemaVersion" in data) {
    updates.push("schema_version=?");
    paramsList.push(data.schemaVersion);
  }

  updates.push("updated_at=?");
  paramsList.push(Date.now());

  if (hasUserId.collections) {
    db.prepare(`UPDATE collections SET ${updates.join(", ")} WHERE user_id=? AND id=?`).run(
      ...paramsList,
      DEFAULT_USER_ID,
      params.id,
    );
  } else {
    db.prepare(`UPDATE collections SET ${updates.join(", ")} WHERE id=?`).run(...paramsList, params.id);
  }

  const row = hasUserId.collections
    ? db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM collections WHERE id=?").get(params.id);
  return NextResponse.json(rowToCollection(row));
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (hasUserId.collections) {
    db.prepare("DELETE FROM collections WHERE id=? AND user_id=?").run(params.id, DEFAULT_USER_ID);
  } else {
    db.prepare("DELETE FROM collections WHERE id=?").run(params.id);
  }
  return NextResponse.json({ success: true });
}
