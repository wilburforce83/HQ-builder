import { db, DEFAULT_USER_ID, hasUserId } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const row = hasUserId.assets
    ? (db
        .prepare("SELECT blob,mime_type,name FROM assets WHERE id=? AND user_id=?")
        .get(params.id, DEFAULT_USER_ID) as
        | { blob: Buffer; mime_type: string; name: string }
        | undefined)
    : (db
        .prepare("SELECT blob,mime_type,name FROM assets WHERE id=?")
        .get(params.id) as { blob: Buffer; mime_type: string; name: string } | undefined);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(row.blob, {
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename=\"${row.name || params.id}\"`,
    },
  });
}
