import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { checkOrigin } from "@/lib/originGuard";
import { LEADS_DIR } from "@/lib/config";
import { LEAD_STAGES, type LeadStage } from "@/lib/vault/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// THE one vault write in this app (owner-approved): the outreach board
// moves a lead between pipeline stages. Rewrites `stage:` + `updated:` frontmatter
// and appends a dated line to the note's Outreach Log. Scoped to .md files
// directly inside LEADS_DIR — nothing else in the vault is ever written.
export async function POST(req: Request): Promise<Response> {
  const rejected = checkOrigin(req);
  if (rejected) return rejected;
  const body = (await req.json().catch(() => ({}))) as {
    file?: string;
    stage?: string;
    note?: string;
  };
  const { file, stage } = body;
  if (!file || !stage || !(LEAD_STAGES as readonly string[]).includes(stage))
    return NextResponse.json({ ok: false, error: "missing/invalid file or stage" }, { status: 400 });
  if (file !== path.basename(file) || !file.toLowerCase().endsWith(".md"))
    return NextResponse.json({ ok: false, error: "invalid file" }, { status: 400 });

  const filePath = path.join(LEADS_DIR, file);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return NextResponse.json({ ok: false, error: "lead note not found" }, { status: 404 });
  }
  if (!/^type:\s*lead\s*$/m.test(raw))
    return NextResponse.json({ ok: false, error: "not a lead note" }, { status: 422 });
  if (!/^stage:\s*\S+/m.test(raw))
    return NextResponse.json({ ok: false, error: "note has no stage field" }, { status: 422 });

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let text = raw
    .replace(/^stage:.*$/m, `stage: ${stage as LeadStage}`)
    .replace(/^updated:.*$/m, `updated: ${today}`);

  const trimmedNote = (body.note ?? "").trim();
  const logLine = `- ${today} — moved to ${stage}${trimmedNote ? ` — ${trimmedNote}` : ""}`;
  const lines = text.split(/\r?\n/);
  const h = lines.findIndex((l) => l.trim().toLowerCase() === "## outreach log");
  if (h === -1) {
    text = text.replace(/\s*$/, `\n\n## Outreach Log\n\n${logLine}\n`);
  } else {
    let end = lines.length;
    for (let i = h + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i].trim())) {
        end = i;
        break;
      }
    }
    const bullets = lines
      .slice(h + 1, end)
      .filter((l) => l.trim() !== "" && l.trim() !== "- (none yet)");
    lines.splice(h + 1, end - (h + 1), "", ...bullets, logLine, "");
    text = lines.join("\n");
  }

  try {
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, filePath);
  } catch {
    return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stage, file });
}
