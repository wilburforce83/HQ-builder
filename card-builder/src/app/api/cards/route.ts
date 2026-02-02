import { NextResponse } from "next/server";
import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowToCard(row: any) {
  return {
    id: row.id,
    templateId: row.template_id,
    status: row.status,
    name: row.name,
    nameLower: row.name_lower,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
    title: row.title,
    description: row.description,
    imageAssetId: row.image_asset_id,
    imageAssetName: row.image_asset_name,
    imageScale: row.image_scale,
    imageOffsetX: row.image_offset_x,
    imageOffsetY: row.image_offset_y,
    imageOriginalWidth: row.image_original_width,
    imageOriginalHeight: row.image_original_height,
    heroAttackDice: row.hero_attack_dice,
    heroDefendDice: row.hero_defend_dice,
    heroBodyPoints: row.hero_body_points,
    heroMindPoints: row.hero_mind_points,
    monsterMovementSquares: row.monster_movement_squares,
    monsterAttackDice: row.monster_attack_dice,
    monsterDefendDice: row.monster_defend_dice,
    monsterBodyPoints: row.monster_body_points,
    monsterMindPoints: row.monster_mind_points,
    monsterIconAssetId: row.monster_icon_asset_id,
    monsterIconAssetName: row.monster_icon_asset_name,
    thumbnailDataUrl: row.thumbnail_data_url,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  let query = "SELECT * FROM cards";
  const params: any[] = [];
  const clauses: string[] = [];

  if (hasUserId.cards) {
    clauses.push("user_id=?");
    params.push(DEFAULT_USER_ID);
  }

  if (templateId) {
    clauses.push("template_id=?");
    params.push(templateId);
  }
  if (status) {
    clauses.push("status=?");
    params.push(status);
  }
  if (search) {
    clauses.push("name_lower LIKE ?");
    params.push(`%${search.toLowerCase()}%`);
  }

  if (clauses.length) {
    query += ` WHERE ${clauses.join(" AND ")}`;
  }
  query += " ORDER BY updated_at DESC";

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows.map(rowToCard));
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = data.id ?? crypto.randomUUID();
  const name = data.name;
  const templateId = data.templateId;
  const status = data.status;

  if (!name || !templateId || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = Date.now();
  const createdAt = data.createdAt ?? now;
  const updatedAt = data.updatedAt ?? now;
  const schemaVersion = data.schemaVersion ?? 1;
  const nameLower = data.nameLower ?? name.toLowerCase();

  if (hasUserId.cards) {
    db.prepare(
      `INSERT OR REPLACE INTO cards (
        id,user_id,template_id,status,name,name_lower,created_at,updated_at,schema_version,
        title,description,image_asset_id,image_asset_name,image_scale,image_offset_x,image_offset_y,
        image_original_width,image_original_height,hero_attack_dice,hero_defend_dice,hero_body_points,
        hero_mind_points,monster_movement_squares,monster_attack_dice,monster_defend_dice,
        monster_body_points,monster_mind_points,monster_icon_asset_id,monster_icon_asset_name,
        thumbnail_data_url
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      DEFAULT_USER_ID,
      templateId,
      status,
      name,
      nameLower,
      createdAt,
      updatedAt,
      schemaVersion,
      data.title ?? null,
      data.description ?? null,
      data.imageAssetId ?? null,
      data.imageAssetName ?? null,
      data.imageScale ?? null,
      data.imageOffsetX ?? null,
      data.imageOffsetY ?? null,
      data.imageOriginalWidth ?? null,
      data.imageOriginalHeight ?? null,
      data.heroAttackDice ?? null,
      data.heroDefendDice ?? null,
      data.heroBodyPoints ?? null,
      data.heroMindPoints ?? null,
      data.monsterMovementSquares ?? null,
      data.monsterAttackDice ?? null,
      data.monsterDefendDice ?? null,
      data.monsterBodyPoints ?? null,
      data.monsterMindPoints ?? null,
      data.monsterIconAssetId ?? null,
      data.monsterIconAssetName ?? null,
      data.thumbnailDataUrl ?? null,
    );
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO cards (
        id,template_id,status,name,name_lower,created_at,updated_at,schema_version,
        title,description,image_asset_id,image_asset_name,image_scale,image_offset_x,image_offset_y,
        image_original_width,image_original_height,hero_attack_dice,hero_defend_dice,hero_body_points,
        hero_mind_points,monster_movement_squares,monster_attack_dice,monster_defend_dice,
        monster_body_points,monster_mind_points,monster_icon_asset_id,monster_icon_asset_name,
        thumbnail_data_url
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      templateId,
      status,
      name,
      nameLower,
      createdAt,
      updatedAt,
      schemaVersion,
      data.title ?? null,
      data.description ?? null,
      data.imageAssetId ?? null,
      data.imageAssetName ?? null,
      data.imageScale ?? null,
      data.imageOffsetX ?? null,
      data.imageOffsetY ?? null,
      data.imageOriginalWidth ?? null,
      data.imageOriginalHeight ?? null,
      data.heroAttackDice ?? null,
      data.heroDefendDice ?? null,
      data.heroBodyPoints ?? null,
      data.heroMindPoints ?? null,
      data.monsterMovementSquares ?? null,
      data.monsterAttackDice ?? null,
      data.monsterDefendDice ?? null,
      data.monsterBodyPoints ?? null,
      data.monsterMindPoints ?? null,
      data.monsterIconAssetId ?? null,
      data.monsterIconAssetName ?? null,
      data.thumbnailDataUrl ?? null,
    );
  }

  const row = hasUserId.cards
    ? db.prepare("SELECT * FROM cards WHERE id=? AND user_id=?").get(id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM cards WHERE id=?").get(id);
  return NextResponse.json(rowToCard(row), { status: 201 });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const ids = body?.ids as string[] | undefined;
  if (!ids || ids.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }
  const placeholders = ids.map(() => "?").join(",");
  if (hasUserId.cards) {
    db.prepare(`DELETE FROM cards WHERE user_id=? AND id IN (${placeholders})`).run(
      DEFAULT_USER_ID,
      ...ids,
    );
  } else {
    db.prepare(`DELETE FROM cards WHERE id IN (${placeholders})`).run(...ids);
  }
  return NextResponse.json({ success: true, deleted: ids.length });
}
