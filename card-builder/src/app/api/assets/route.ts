import { NextResponse } from "next/server";
import { isIconFilename, parseIconMetaFromFilename } from "@/lib/icon-assets";
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
    ratioW: row.ratio_w ?? null,
    ratioH: row.ratio_h ?? null,
    paddingPct: row.padding_pct ?? null,
    iconType: row.icon_type ?? null,
    iconName: row.icon_name ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const excludeCategory = searchParams.get("excludeCategory");

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (hasUserId.assets) {
    whereClauses.push("user_id=?");
    params.push(DEFAULT_USER_ID);
  }

  if (category) {
    whereClauses.push("category=?");
    params.push(category);
  } else if (excludeCategory) {
    whereClauses.push("(category IS NULL OR category != ?)");
    params.push(excludeCategory);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql =
    `SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name ` +
    `FROM assets ${where} ORDER BY created_at DESC`;

  const rows = db.prepare(sql).all(...params);
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
  const categoryRaw = (formData.get("category") as string | null) ?? null;
  const gridWRaw = formData.get("gridW") as string | null;
  const gridHRaw = formData.get("gridH") as string | null;
  const ratioWRaw = formData.get("ratioW") as string | null;
  const ratioHRaw = formData.get("ratioH") as string | null;
  const paddingPctRaw = formData.get("paddingPct") as string | null;
  const iconTypeRaw = (formData.get("iconType") as string | null) ?? null;
  const iconNameRaw = (formData.get("iconName") as string | null) ?? null;

  const category = categoryRaw && categoryRaw.trim() ? categoryRaw.trim() : null;

  if (!widthRaw || !heightRaw) {
    return NextResponse.json({ error: "Missing width/height" }, { status: 400 });
  }

  const width = Number.parseInt(widthRaw, 10);
  const height = Number.parseInt(heightRaw, 10);
  let gridW = gridWRaw ? Number.parseInt(gridWRaw, 10) : null;
  let gridH = gridHRaw ? Number.parseInt(gridHRaw, 10) : null;
  let ratioW = ratioWRaw ? Number.parseFloat(ratioWRaw) : null;
  let ratioH = ratioHRaw ? Number.parseFloat(ratioHRaw) : null;
  let paddingPct = paddingPctRaw ? Number.parseFloat(paddingPctRaw) : null;
  let iconType = iconTypeRaw && iconTypeRaw.trim() ? iconTypeRaw.trim() : null;
  let iconName = iconNameRaw && iconNameRaw.trim() ? iconNameRaw.trim() : null;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return NextResponse.json({ error: "Invalid width/height" }, { status: 400 });
  }

  if (ratioW != null && (!Number.isFinite(ratioW) || ratioW <= 0)) {
    ratioW = null;
  }
  if (ratioH != null && (!Number.isFinite(ratioH) || ratioH <= 0)) {
    ratioH = null;
  }
  if (paddingPct != null) {
    if (!Number.isFinite(paddingPct)) {
      paddingPct = null;
    } else {
      paddingPct = Math.min(Math.max(paddingPct, 0), 100);
    }
  }

  const looksLikeIcon = category === "icon" || isIconFilename(name);
  if (looksLikeIcon) {
    const parsed = parseIconMetaFromFilename(name);
    iconType = iconType ?? parsed.iconType ?? null;
    iconName = iconName ?? parsed.iconName ?? null;
  } else {
    iconType = null;
    iconName = null;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const createdAt = Date.now();

  if (hasUserId.assets) {
    db.prepare(
      `INSERT OR REPLACE INTO assets (
        id,user_id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name,blob
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      DEFAULT_USER_ID,
      name,
      mimeType,
      width,
      height,
      createdAt,
      looksLikeIcon ? "icon" : category,
      gridW,
      gridH,
      ratioW,
      ratioH,
      paddingPct,
      iconType,
      iconName,
      buffer,
    );
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO assets (
        id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name,blob
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      name,
      mimeType,
      width,
      height,
      createdAt,
      looksLikeIcon ? "icon" : category,
      gridW,
      gridH,
      ratioW,
      ratioH,
      paddingPct,
      iconType,
      iconName,
      buffer,
    );
  }

  const row = hasUserId.assets
    ? db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name FROM assets WHERE id=? AND user_id=?",
        )
        .get(id, DEFAULT_USER_ID)
    : db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name FROM assets WHERE id=?",
        )
        .get(id);

  return NextResponse.json(rowToAsset(row), { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id } = payload as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Missing asset id" }, { status: 400 });
  }

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if ("name" in payload) {
    const nameRaw = (payload as { name?: string }).name ?? "";
    const name = nameRaw.trim();
    if (!name) {
      return NextResponse.json({ error: "Missing asset name" }, { status: 400 });
    }
    updates.push("name=?");
    params.push(name);
  }

  if ("iconType" in payload) {
    const iconTypeRaw = (payload as { iconType?: string | null }).iconType;
    const iconType =
      typeof iconTypeRaw === "string" && iconTypeRaw.trim() ? iconTypeRaw.trim() : null;
    updates.push("icon_type=?");
    params.push(iconType);
  }

  if ("iconName" in payload) {
    const iconNameRaw = (payload as { iconName?: string | null }).iconName;
    const iconName =
      typeof iconNameRaw === "string" && iconNameRaw.trim() ? iconNameRaw.trim() : null;
    updates.push("icon_name=?");
    params.push(iconName);
  }

  if ("gridW" in payload) {
    const gridWRaw = (payload as { gridW?: number | string | null }).gridW;
    const parsed =
      gridWRaw == null
        ? null
        : typeof gridWRaw === "number"
          ? gridWRaw
          : Number.parseInt(gridWRaw, 10);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: "Invalid gridW" }, { status: 400 });
    }
    updates.push("grid_w=?");
    params.push(parsed);
  }

  if ("gridH" in payload) {
    const gridHRaw = (payload as { gridH?: number | string | null }).gridH;
    const parsed =
      gridHRaw == null
        ? null
        : typeof gridHRaw === "number"
          ? gridHRaw
          : Number.parseInt(gridHRaw, 10);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: "Invalid gridH" }, { status: 400 });
    }
    updates.push("grid_h=?");
    params.push(parsed);
  }

  if ("ratioW" in payload) {
    const ratioWRaw = (payload as { ratioW?: number | string | null }).ratioW;
    const parsed =
      ratioWRaw == null
        ? null
        : typeof ratioWRaw === "number"
          ? ratioWRaw
          : Number.parseFloat(ratioWRaw);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: "Invalid ratioW" }, { status: 400 });
    }
    updates.push("ratio_w=?");
    params.push(parsed);
  }

  if ("ratioH" in payload) {
    const ratioHRaw = (payload as { ratioH?: number | string | null }).ratioH;
    const parsed =
      ratioHRaw == null
        ? null
        : typeof ratioHRaw === "number"
          ? ratioHRaw
          : Number.parseFloat(ratioHRaw);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      return NextResponse.json({ error: "Invalid ratioH" }, { status: 400 });
    }
    updates.push("ratio_h=?");
    params.push(parsed);
  }

  if ("paddingPct" in payload) {
    const paddingRaw = (payload as { paddingPct?: number | string | null }).paddingPct;
    const parsed =
      paddingRaw == null
        ? null
        : typeof paddingRaw === "number"
          ? paddingRaw
          : Number.parseFloat(paddingRaw);
    if (parsed != null && !Number.isFinite(parsed)) {
      return NextResponse.json({ error: "Invalid paddingPct" }, { status: 400 });
    }
    const clamped = parsed == null ? null : Math.min(Math.max(parsed, 0), 100);
    updates.push("padding_pct=?");
    params.push(clamped);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const where = hasUserId.assets ? "id=? AND user_id=?" : "id=?";
  params.push(id);
  if (hasUserId.assets) {
    params.push(DEFAULT_USER_ID);
  }

  const result = db
    .prepare(`UPDATE assets SET ${updates.join(", ")} WHERE ${where}`)
    .run(...params);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const row = hasUserId.assets
    ? db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name FROM assets WHERE id=? AND user_id=?",
        )
        .get(id, DEFAULT_USER_ID)
    : db
        .prepare(
          "SELECT id,name,mime_type,width,height,created_at,category,grid_w,grid_h,ratio_w,ratio_h,padding_pct,icon_type,icon_name FROM assets WHERE id=?",
        )
        .get(id);

  if (!row) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json(rowToAsset(row));
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
