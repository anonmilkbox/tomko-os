import { LEADS_DIR, LEADS_INDEX_FILE, STALE_DAYS_THRESHOLD } from "../config";
import { readAllNotes, extractSection, extractBullets } from "./notes";
import { daysSince } from "../dates";
import { obsidianLink } from "../links";

// Outreach pipeline stages. `pool` = unvetted or quarantined — never shown on
// the board; a lead graduates pool → to-contact only once verified as a legit
// candidate.
export const LEAD_STAGES = ["pool", "to-contact", "contacted", "responded", "converted", "dead"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface Lead {
  name: string;
  filePath: string;
  stage: LeadStage;
  updated: string | null;
  lastContact: string | null;
  lastContactNote: string | null;
  daysQuiet: number | null;
  pendingFollowUp: boolean;
  link: string;
}

const OUTREACH_ENTRY = /^(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.*)$/;

export function getLeads(): Lead[] {
  // Filename exclusion is a belt-and-suspenders second guard; the frontmatter
  // `type: lead` filter is the primary gate so stray .md files never become leads.
  const notes = readAllNotes(LEADS_DIR, [LEADS_INDEX_FILE]).filter(
    (n) => n.data.type === "lead"
  );
  return notes.map((note) => {
    const stage: LeadStage = LEAD_STAGES.includes(note.data.stage) ? note.data.stage : "pool";
    const updated: string | null = note.data.updated ?? null;
    const logBody = extractSection(note.content, "Outreach Log");
    const bullets = extractBullets(logBody);

    let lastContact: string | null = null;
    let lastContactNote: string | null = null;
    for (const b of bullets) {
      const m = OUTREACH_ENTRY.exec(b);
      if (m) {
        lastContact = m[1];
        lastContactNote = m[2];
      }
    }
    const pendingFollowUp = bullets.some((b) => /DRAFT \(pending send\)/i.test(b));
    const daysQuiet = daysSince(lastContact ?? updated);

    return {
      name: note.fileName.replace(/\.md$/i, ""),
      filePath: note.filePath,
      stage,
      updated,
      lastContact,
      lastContactNote,
      daysQuiet,
      pendingFollowUp,
      link: obsidianLink(note.filePath),
    };
  });
}

// Stale = outreach happened and the lead went quiet. Pool/to-contact leads
// aren't stale — nothing has been sent yet.
export function isStaleLead(lead: Lead): boolean {
  return (
    (lead.stage === "contacted" || lead.stage === "responded") &&
    lead.daysQuiet !== null &&
    lead.daysQuiet > STALE_DAYS_THRESHOLD
  );
}

export function leadsByStage(leads: Lead[]): Record<LeadStage, number> {
  const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
  for (const l of leads) counts[l.stage] += 1;
  return counts;
}
