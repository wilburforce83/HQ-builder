import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import boardData from "@/data/boardData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlacedItem = {
  id: string;
  assetId: string;
  source: "builtin" | "custom";
  x: number;
  y: number;
  baseW: number;
  baseH: number;
  spanW?: number;
  spanH?: number;
  rotation: number;
  layer: "tile" | "furniture" | "monster";
};

type QuestPayload = {
  title?: string | null;
  campaign?: string | null;
  author?: string | null;
  story?: string | null;
  notes?: string | null;
  wanderingMonster?: string | null;
  data?: { items?: PlacedItem[] } | null;
};

const BUILTIN_ASSET_URLS: Record<string, string> = {
  "monster-goblin": "/static/img/Monsters/goblin.svg",
  "monster-orc": "/static/img/Monsters/orc.svg",
  "monster-zombie": "/static/img/Monsters/zombie.svg",
  "monster-mummy": "/static/img/Monsters/mummy.svg",
  "monster-skeleton": "/static/img/Monsters/skeleton.svg",
  "monster-abomination": "/static/img/Monsters/abomination.svg",
  "monster-doom-warrior": "/static/img/Monsters/doom_warrior.svg",
  "monster-gargoyle": "/static/img/Monsters/gargoyle.svg",
  "monster-chaos-sorcerer": "/static/img/Monsters/chaossorcerer.svg",
  "hero-barbarian": "/static/img/Heroes/barbarian.svg",
  "hero-dwarf": "/static/img/Heroes/dwarf.svg",
  "hero-elf": "/static/img/Heroes/elf.svg",
  "hero-wizard": "/static/img/Heroes/wizard.svg",
  "furniture-block-single": "/static/img/Furniture/block_single.svg",
  "furniture-block-double": "/static/img/Furniture/block_double.svg",
  "furniture-bookcase": "/static/img/Furniture/bookcase.svg",
  "furniture-cupboard": "/static/img/Furniture/cupboard.svg",
  "furniture-fireplace": "/static/img/Furniture/fireplace.svg",
  "furniture-weapon-rack": "/static/img/Furniture/weapon_rack.svg",
  "furniture-stairs": "/static/img/Furniture/stairs.svg",
  "furniture-table": "/static/img/Furniture/table.svg",
  "furniture-alchemists-desk": "/static/img/Furniture/alchemists_desk.svg",
  "furniture-torture-rack": "/static/img/Furniture/torture_rack.svg",
  "furniture-tomb": "/static/img/Furniture/tomb.svg",
  "furniture-sorcerers-table": "/static/img/Furniture/sorcerers_table.svg",
  "furniture-throne": "/static/img/Furniture/throne.svg",
  "furniture-chest": "/static/img/Furniture/chest.svg",
  "furniture-chesttrap": "/static/img/Furniture/chesttrap.svg",
  "furniture-door": "/static/img/Furniture/door.svg",
  "furniture-secret-door": "/static/img/Furniture/secret_door.svg",
  "tile-trap-pit": "/static/img/Furniture/trap_pit.svg",
  "tile-trap-spear": "/static/img/Furniture/trap_spear.svg",
  "tile-trap-block": "/static/img/Furniture/trap_block.svg",
  "mark-arrow-diagonal": "/static/img/Markings/arrow_diagonal.svg",
  "mark-arrow": "/static/img/Markings/arrow.svg",
  "mark-A": "/static/img/Markings/letterA.svg",
  "mark-B": "/static/img/Markings/letterB.svg",
  "mark-C": "/static/img/Markings/letterC.svg",
  "mark-D": "/static/img/Markings/letterD.svg",
  "mark-E": "/static/img/Markings/letterE.svg",
  "mark-F": "/static/img/Markings/letterF.svg",
  "mark-G": "/static/img/Markings/letterG.svg",
  "mark-H": "/static/img/Markings/letterH.svg",
  "mark-I": "/static/img/Markings/letterI.svg",
  "mark-J": "/static/img/Markings/letterJ.svg",
  "mark-K": "/static/img/Markings/letterK.svg",
  "mark-L": "/static/img/Markings/letterL.svg",
  "mark-M": "/static/img/Markings/letterM.svg",
  "mark-1": "/static/img/Markings/number1.svg",
  "mark-2": "/static/img/Markings/number2.svg",
  "mark-3": "/static/img/Markings/number3.svg",
  "mark-4": "/static/img/Markings/number4.svg",
  "mark-5": "/static/img/Markings/number5.svg",
  "mark-6": "/static/img/Markings/number6.svg",
  "mark-7": "/static/img/Markings/number7.svg",
  "mark-8": "/static/img/Markings/number8.svg",
  "mark-9": "/static/img/Markings/number9.svg",
  "mark-10": "/static/img/Markings/number10.svg",
};

function spanForRotation(baseW: number, baseH: number, rotation: number) {
  if (rotation % 180 === 0) {
    return { w: baseW, h: baseH };
  }
  return { w: baseH, h: baseW };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBaseUrl(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as QuestPayload;
  const baseUrl = getBaseUrl(request);

  const templatePath = path.join(process.cwd(), "src/templates/quest-pdf.html");
  let template = await readFile(templatePath, "utf-8");

  const mapCells = boardData
    .map((row, rowIndex) =>
      row
        .map((cell, colIndex) => {
          const classes = ["cell"];
          if (cell.t === "corridor") classes.push("corridor");
          if (cell.b.includes("l")) classes.push("borderLeft");
          if (cell.b.includes("r")) classes.push("borderRight");
          if (cell.b.includes("t")) classes.push("borderTop");
          if (cell.b.includes("b")) classes.push("borderBottom");
          return `<div class=\"${classes.join(" ")}\" data-row=\"${rowIndex}\" data-col=\"${colIndex}\"></div>`;
        })
        .join(""),
    )
    .join("");

  const items = payload.data?.items ?? [];
  const mapItems = items
    .map((item) => {
      const span = spanForRotation(item.baseW, item.baseH, item.rotation ?? 0);
      const url =
        item.source === "builtin"
          ? BUILTIN_ASSET_URLS[item.assetId]
          : `/api/assets/${item.assetId}/blob`;
      if (!url) return "";
      const absUrl = `${baseUrl}${url}`;
      const rotation = item.rotation ?? 0;
      const baseRatio = item.baseW / item.baseH;
      const rotateScale = rotation % 180 === 0 ? 1 : Math.max(baseRatio, 1 / baseRatio);
      const scale = Number.isFinite(rotateScale) && rotateScale > 0 ? rotateScale : 1;
      return `<div class=\"item\" style=\"grid-column:${item.x + 1} / span ${span.w}; grid-row:${item.y + 1} / span ${span.h};\">\n  <img src=\"${absUrl}\" alt=\"\" style=\"transform: rotate(${rotation}deg) scale(${scale});\" />\n</div>`;
    })
    .join("");

  const story = payload.story ?? "";
  const notes = payload.notes ?? "";
  const title = payload.title ?? "Untitled Quest";
  const campaignRaw = payload.campaign ?? "";
  const campaign = campaignRaw.trim()
    ? campaignRaw.trim().toUpperCase()
    : "STANDALONE QUEST";
  const wandering = payload.wanderingMonster
    ? `Wandering Monster in this Quest: ${payload.wanderingMonster}`
    : "";
  const wanderingIconUrl = payload.data?.wandering
    ? (() => {
        const candidate = payload.data?.wandering;
        if (!candidate) return "";
        const url =
          candidate.source === "builtin"
            ? BUILTIN_ASSET_URLS[candidate.assetId]
            : `/api/assets/${candidate.assetId}/blob`;
        return url ? `${baseUrl}${url}` : "";
      })()
    : "";

  template = template
    .replace(/{{TITLE}}/g, escapeHtml(title))
    .replace(/{{CAMPAIGN}}/g, escapeHtml(campaign))
    .replace("{{STORY}}", escapeHtml(story))
    .replace("{{NOTES}}", escapeHtml(notes))
    .replace(
      "{{WANDERING}}",
      wandering
        ? `${wanderingIconUrl ? `<img src=\"${wanderingIconUrl}\" alt=\"\" />` : ""}${escapeHtml(wandering)}`
        : "",
    )
    .replace("{{MAP_CELLS}}", mapCells)
    .replace("{{MAP_ITEMS}}", mapItems)
    .replace(/{{WALLPAPER_URL}}/g, `${baseUrl}/static/img/decorations/wallpaper.jpg`)
    .replace(/{{BORDER_URL}}/g, `${baseUrl}/static/img/decorations/border.png`)
    .replace(/{{PAPER_URL}}/g, `${baseUrl}/static/img/decorations/background.png`);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(template, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0cm",
        right: "0cm",
        bottom: "0cm",
        left: "0cm",
      },
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${title.replace(/[^a-z0-9_-]+/gi, "_")}\"`,
      },
    });
  } finally {
    await browser.close();
  }
}
