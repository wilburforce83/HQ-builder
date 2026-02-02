import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowToAsset(row: any) {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    category: row.category ?? null,
    gridW: row.grid_w ?? null,
    gridH: row.grid_h ?? null,
  };
}

export async function GET() {
  const rows = hasUserId.assets
    ? db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h FROM assets WHERE user_id=? ORDER BY created_at DESC",
        )
        .all(DEFAULT_USER_ID)
    : db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h FROM assets ORDER BY created_at DESC",
        )
        .all();
  return NextResponse.json(rows.map(rowToAsset));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const id = (formData.get("id") as string | null) ?? crypto.randomUUID();
  const name = (formData.get("name") as string | null) ?? file.name;
  const mimeType = (formData.get("mimeType") as string | null) ?? file.type;
  const widthRaw = formData.get("width") as string | null;
  const heightRaw = formData.get("height") as string | null;
  const category = (formData.get("category") as string | null) ?? null;
  const gridWRaw = formData.get("gridW") as string | null;
  const gridHRaw = formData.get("gridH") as string | null;

  if (!widthRaw || !heightRaw) {
    return NextResponse.json({ error: "Missing width/height" }, { status: 400 });
  }

  const width = Number.parseInt(widthRaw, 10);
  const height = Number.parseInt(heightRaw, 10);
  const gridW = gridWRaw ? Number.parseInt(gridWRaw, 10) : null;
  const gridH = gridHRaw ? Number.parseInt(gridHRaw, 10) : null;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return NextResponse.json({ error: "Invalid width/height" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const createdAt = Date.now();

  if (hasUserId.assets) {
    db.prepare(
      `INSERT OR REPLACE INTO assets (
        id,user_id,name,mime_type,width,height,created_at,category,grid_w,grid_h,blob
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      DEFAULT_USER_ID,
      name,
      mimeType,
      width,
      height,
      createdAt,
      category,
      gridW,
      gridH,
      buffer,
    );
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO assets (
        id,name,mime_type,width,height,created_at,category,grid_w,grid_h,blob
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(id, name, mimeType, width, height, createdAt, category, gridW, gridH, buffer);
  }

  const row = hasUserId.assets
    ? db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h FROM assets WHERE id=? AND user_id=?",
        )
        .get(id, DEFAULT_USER_ID)
    : db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h FROM assets WHERE id=?",
        )
        .get(id);

  return NextResponse.json(rowToAsset(row), { status: 201 });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const ids = body?.ids as string[] | undefined;
  if (!ids || ids.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  const placeholders = ids.map(() => "?").join(",");
  if (hasUserId.assets) {
    db.prepare(`DELETE FROM assets WHERE user_id=? AND id IN (${placeholders})`).run(
      DEFAULT_USER_ID,
      ...ids,
    );
  } else {
    db.prepare(`DELETE FROM assets WHERE id IN (${placeholders})`).run(...ids);
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
