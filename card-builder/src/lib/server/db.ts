import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { isIconFilename, parseIconMetaFromFilename } from "@/lib/icon-assets";

const dbPath =
  process.env.HQ_DB_PATH ?? path.join(process.cwd(), "..", "db", "hqbuilder.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
const DEFAULT_USER_ID = 1;

type TableColumn = { name: string };

function tableExists(table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as TableColumn[];
  return rows.some((row) => row.name === column);
}

function addColumn(table: string, columnSql: string, columnName: string) {
  if (columnExists(table, columnName)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`).run();
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      category TEXT,
      grid_w INTEGER,
      grid_h INTEGER,
      icon_type TEXT,
      icon_name TEXT,
      blob BLOB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER,
      template_id TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      name_lower TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      schema_version INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      image_asset_id TEXT,
      image_asset_name TEXT,
      image_scale REAL,
      image_offset_x REAL,
      image_offset_y REAL,
      image_original_width REAL,
      image_original_height REAL,
      hero_attack_dice INTEGER,
      hero_defend_dice INTEGER,
      hero_body_points INTEGER,
      hero_mind_points INTEGER,
      monster_movement_squares INTEGER,
      monster_attack_dice INTEGER,
      monster_defend_dice INTEGER,
      monster_body_points INTEGER,
      monster_mind_points INTEGER,
      monster_icon_asset_id TEXT,
      monster_icon_asset_name TEXT,
      thumbnail_data_url TEXT
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      card_ids TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      schema_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER,
      title TEXT,
      author TEXT,
      story TEXT,
      notes TEXT,
      wandering_monster TEXT,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quest_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      quest_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cards_name_lower ON cards(name_lower);
    CREATE INDEX IF NOT EXISTS idx_cards_template_status ON cards(template_id, status);
    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
    CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
    CREATE INDEX IF NOT EXISTS idx_quests_updated_at ON quests(updated_at);
  `);

  // Ensure new optional columns exist on older DBs.
  addColumn("assets", "category TEXT", "category");
  addColumn("assets", "grid_w INTEGER", "grid_w");
  addColumn("assets", "grid_h INTEGER", "grid_h");
  addColumn("assets", "icon_type TEXT", "icon_type");
  addColumn("assets", "icon_name TEXT", "icon_name");
  addColumn("cards", "thumbnail_data_url TEXT", "thumbnail_data_url");
  addColumn("assets", "user_id INTEGER", "user_id");
  addColumn("cards", "user_id INTEGER", "user_id");
  addColumn("collections", "user_id INTEGER", "user_id");
  addColumn("quests", "user_id INTEGER", "user_id");
}

initDb();

function migrateIconAssets() {
  if (!tableExists("assets")) return;

  const rows = db
    .prepare(
      "SELECT id,name,category,grid_w,grid_h,icon_type,icon_name FROM assets",
    )
    .all() as Array<{
    id: string;
    name: string;
    category: string | null;
    grid_w: number | null;
    grid_h: number | null;
    icon_type: string | null;
    icon_name: string | null;
  }>;

  const update = db.prepare(
    "UPDATE assets SET category=?, grid_w=?, grid_h=?, icon_type=?, icon_name=? WHERE id=?",
  );

  for (const row of rows) {
    if (!isIconFilename(row.name)) continue;

    const parsed = parseIconMetaFromFilename(row.name);
    const iconType = row.icon_type ?? parsed.iconType ?? null;
    const iconName = row.icon_name ?? parsed.iconName ?? null;

    const needsUpdate =
      row.category !== "icon" ||
      row.grid_w !== 1 ||
      row.grid_h !== 1 ||
      row.icon_type !== iconType ||
      row.icon_name !== iconName;

    if (!needsUpdate) continue;

    update.run("icon", 1, 1, iconType, iconName, row.id);
  }
}

migrateIconAssets();

function ensureDefaultUser() {
  if (!tableExists("users")) return;
  const row = db.prepare("SELECT id FROM users WHERE id=?").get(DEFAULT_USER_ID) as
    | { id: number }
    | undefined;
  if (row) return;
  db.prepare("INSERT INTO users (id, username, hash) VALUES (?, ?, ?)").run(
    DEFAULT_USER_ID,
    "local",
    "local",
  );
}

ensureDefaultUser();

const hasUserId = {
  assets: columnExists("assets", "user_id"),
  cards: columnExists("cards", "user_id"),
  collections: columnExists("collections", "user_id"),
  quests: columnExists("quests", "user_id"),
};

export { db, DEFAULT_USER_ID, hasUserId };
