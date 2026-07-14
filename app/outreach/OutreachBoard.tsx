"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lead, LeadStage } from "@/lib/vault/leads";

// Board columns. `pool` is deliberately absent — unvetted leads never render;
// the select still offers it so a bad lead can be demoted back off the board.
const COLUMNS: { stage: LeadStage; label: string }[] = [
  { stage: "to-contact", label: "TO CONTACT" },
  { stage: "contacted", label: "CONTACTED" },
  { stage: "responded", label: "RESPONDED" },
  { stage: "converted", label: "CONVERTED" },
  { stage: "dead", label: "DEAD" },
];
const ALL_STAGES: LeadStage[] = ["pool", "to-contact", "contacted", "responded", "converted", "dead"];

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  async function move(stage: LeadStage) {
    // ponytail: window.prompt over a modal — skippable, native, good enough for v1
    const note = window.prompt(`${lead.name} → ${stage}\nLog note (optional):`) ?? undefined;
    setError(false);
    const res = await fetch("/api/leads/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: `${lead.name}.md`, stage, note }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className={`ob-card${pending ? " ob-card-pending" : ""}`}>
      <a href={lead.link} className="row-link ob-card-name" title="open in Obsidian">
        {lead.name}
      </a>
      <div className="ob-card-meta font-data">
        {lead.lastContact ? (
          <span>
            {lead.lastContact}
            {lead.daysQuiet !== null && lead.daysQuiet > 0 ? ` · quiet ${lead.daysQuiet}d` : ""}
          </span>
        ) : (
          <span>no touches yet</span>
        )}
        {lead.pendingFollowUp && <span className="ob-card-flag">draft pending</span>}
      </div>
      {lead.lastContactNote && <div className="ob-card-note">{lead.lastContactNote}</div>}
      <select
        className="ob-move font-data"
        value={lead.stage}
        disabled={pending}
        onChange={(e) => void move(e.target.value as LeadStage)}
        aria-label={`Move ${lead.name}`}
      >
        {ALL_STAGES.map((s) => (
          <option key={s} value={s}>
            {s === lead.stage ? `· ${s}` : `→ ${s}`}
          </option>
        ))}
      </select>
      {error && <div className="ob-card-error font-data">move failed — retry</div>}
    </div>
  );
}

export function OutreachBoard({ leads, poolCount }: { leads: Lead[]; poolCount: number }) {
  return (
    <div className="ob-wrap">
      <div className="ob-grid">
        {COLUMNS.map((col) => {
          const items = leads
            .filter((l) => l.stage === col.stage)
            .sort((a, b) => (b.daysQuiet ?? 0) - (a.daysQuiet ?? 0));
          return (
            <section key={col.stage} className="ob-col">
              <header className="ob-col-head">
                <span className="label-micro">{col.label}</span>
                <span className="font-data ob-col-count">{items.length}</span>
              </header>
              {items.length === 0 ? (
                <p className="label-micro-dim ob-col-empty">empty</p>
              ) : (
                items.map((l) => <LeadCard key={l.filePath} lead={l} />)
              )}
            </section>
          );
        })}
      </div>
      <p className="label-micro-dim ob-pool-line">
        {poolCount} lead{poolCount === 1 ? "" : "s"} in pool (unvetted — hidden). Every move writes the
        lead note in the vault: stage + Outreach Log line.
      </p>
    </div>
  );
}
