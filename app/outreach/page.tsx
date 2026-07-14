import "./outreach.css";
import { DetailShell } from "@/components/DetailShell";
import { EmptyState } from "@/components/EmptyState";
import { getLeads } from "@/lib/vault/leads";
import { OutreachBoard } from "./OutreachBoard";

export const dynamic = "force-dynamic";

export default function OutreachPage() {
  const leads = getLeads();
  const board = leads.filter((l) => l.stage !== "pool");
  const poolCount = leads.length - board.length;
  return (
    <DetailShell title={`OUTREACH · ${board.length}`}>
      {board.length === 0 ? (
        <EmptyState label="No vetted leads — promote leads out of the pool first." />
      ) : (
        <OutreachBoard leads={board} poolCount={poolCount} />
      )}
    </DetailShell>
  );
}
