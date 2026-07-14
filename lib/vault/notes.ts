// Shared markdown/frontmatter plumbing for every vault reader.
// Read-only. The single sanctioned vault write lives in app/api/leads/move
// (outreach board stage moves) — nothing else writes, and never through here.

import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface ParsedNote<T = Record<string, any>> {
  filePath: string;
  fileName: string;
  data: T;
  content: string;
}

export function listMarkdownFiles(dir: string, exclude: string[] = []): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && !exclude.includes(f))
    .map((f) => path.join(dir, f));
}

// Returns null if the file cannot be read (e.g. it vanished between the
// directory listing and this read) — callers must skip null results.
export function readNote(filePath: string): ParsedNote | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  // gray-matter's YAML parser coerces unquoted date scalars (updated: 2026-07-08) into JS
  // Date objects, but every reader treats frontmatter dates as "YYYY-MM-DD" strings
  // (and a Date rendered in JSX throws "Objects are not valid as a React child").
  const normalized = data || {};
  for (const k of Object.keys(normalized)) {
    const v = normalized[k];
    if (v instanceof Date && !isNaN(v.getTime())) {
      normalized[k] = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return { filePath, fileName: path.basename(filePath), data: normalized, content };
}

export function readAllNotes(dir: string, exclude: string[] = []): ParsedNote[] {
  return listMarkdownFiles(dir, exclude)
    .map(readNote)
    .filter((n): n is ParsedNote => n !== null);
}

/** Body of a "## Heading" section, up to the next "## " heading or EOF. Case-insensitive. */
export function extractSection(content: string, heading: string): string | null {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (startIdx === -1) return null;
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => /^##\s/.test(l.trim()));
  const body = endIdx === -1 ? rest : rest.slice(0, endIdx);
  return body.join("\n").trim();
}

/** Top-level "- " bullet lines from a section body, in document order. */
export function extractBullets(sectionBody: string | null): string[] {
  if (!sectionBody) return [];
  return sectionBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}
