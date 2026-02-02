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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const row = hasUserId.cards
    ? db.prepare("SELECT * FROM cards WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM cards WHERE id=?").get(params.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rowToCard(row));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const data = await request.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = hasUserId.cards
    ? db.prepare("SELECT id FROM cards WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT id FROM cards WHERE id=?").get(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fieldMap: Record<string, string> = {
    templateId: "template_id",
    status: "status",
    name: "name",
    nameLower: "name_lower",
    title: "title",
    description: "description",
    imageAssetId: "image_asset_id",
    imageAssetName: "image_asset_name",
    imageScale: "image_scale",
    imageOffsetX: "image_offset_x",
    imageOffsetY: "image_offset_y",
    imageOriginalWidth: "image_original_width",
    imageOriginalHeight: "image_original_height",
    heroAttackDice: "hero_attack_dice",
    heroDefendDice: "hero_defend_dice",
    heroBodyPoints: "hero_body_points",
    heroMindPoints: "hero_mind_points",
    monsterMovementSquares: "monster_movement_squares",
    monsterAttackDice: "monster_attack_dice",
    monsterDefendDice: "monster_defend_dice",
    monsterBodyPoints: "monster_body_points",
    monsterMindPoints: "monster_mind_points",
    monsterIconAssetId: "monster_icon_asset_id",
    monsterIconAssetName: "monster_icon_asset_name",
    thumbnailDataUrl: "thumbnail_data_url",
    schemaVersion: "schema_version",
    createdAt: "created_at",
  };

  const updates: string[] = [];
  const paramsList: any[] = [];

  if (data.name && !data.nameLower) {
    data.nameLower = data.name.toLowerCase();
  }

  for (const key of Object.keys(fieldMap)) {
    if (key in data) {
      updates.push(`${fieldMap[key]}=?`);
      paramsList.push(data[key]);
    }
  }

  updates.push("updated_at=?");
  paramsList.push(Date.now());

  if (hasUserId.cards) {
    db.prepare(`UPDATE cards SET ${updates.join(", ")} WHERE user_id=? AND id=?`).run(
      ...paramsList,
      DEFAULT_USER_ID,
      params.id,
    );
  } else {
    db.prepare(`UPDATE cards SET ${updates.join(", ")} WHERE id=?`).run(...paramsList, params.id);
  }

  const row = hasUserId.cards
    ? db.prepare("SELECT * FROM cards WHERE id=? AND user_id=?").get(params.id, DEFAULT_USER_ID)
    : db.prepare("SELECT * FROM cards WHERE id=?").get(params.id);
  return NextResponse.json(rowToCard(row));
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (hasUserId.cards) {
    db.prepare("DELETE FROM cards WHERE id=? AND user_id=?").run(params.id, DEFAULT_USER_ID);
  } else {
    db.prepare("DELETE FROM cards WHERE id=?").run(params.id);
  }
  return NextResponse.json({ success: true });
}
