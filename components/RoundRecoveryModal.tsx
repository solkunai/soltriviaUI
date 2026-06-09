/**
 * RoundRecoveryModal (web) — mirror of the native modal. Offered to
 * players who paid for a round but never started the questions (boot
 * crash, tab close mid-call, network blip). Resuming calls start-game
 * with the existing tx signature — no SOL is re-spent.
 *
 * Kyle 2026-06-07.
 */

import React from "react";
import type { PendingRoundEntry } from "../src/utils/pendingRoundEntry";

interface Props {
  visible: boolean;
  entry: PendingRoundEntry | null;
  roundEndsAtMs: number | null;
  busy: boolean;
  onResume: () => void;
  onDismiss: () => void;
}

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export default function RoundRecoveryModal({
  visible,
  entry,
  roundEndsAtMs,
  busy,
  onResume,
  onDismiss,
}: Props) {
  if (!visible || !entry) return null;
  const countdownLabel =
    roundEndsAtMs && roundEndsAtMs > Date.now()
      ? formatCountdown(roundEndsAtMs - Date.now())
      : "soon";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{
          background: "#0A0A0A",
          borderColor: "#14F195",
          borderWidth: 1,
        }}
      >
        <div
          className="font-black uppercase italic"
          style={{
            color: "#14F195",
            fontSize: 10,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          UNFINISHED ENTRY DETECTED
        </div>
        <div
          className="font-display font-black italic text-white"
          style={{ fontSize: 22, lineHeight: "26px", marginBottom: 12 }}
        >
          You paid for this round but didn't play.
        </div>
        <div
          className="text-zinc-300"
          style={{ fontSize: 13, lineHeight: "19px", marginBottom: 6 }}
        >
          Your 0.02 SOL entry is still valid. Round ends in{" "}
          <span
            className="font-display font-black italic"
            style={{ color: "#14F195" }}
          >
            {countdownLabel}
          </span>
          . Finish your 10 questions now.
        </div>
        <div
          className="text-zinc-400"
          style={{ fontSize: 11, lineHeight: "16px", marginBottom: 20 }}
        >
          Anti-cheat: same 10-second per-question timer, same server-side
          scoring. Resuming doesn't reveal answers in advance.
        </div>

        <div className="flex" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={busy ? undefined : onDismiss}
            disabled={busy}
            className="flex-1 font-black uppercase italic text-zinc-200"
            style={{
              padding: "14px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 12,
              letterSpacing: 1.4,
              opacity: busy ? 0.4 : 1,
              background: "transparent",
              cursor: busy ? "default" : "pointer",
            }}
          >
            LATER
          </button>
          <button
            type="button"
            onClick={busy ? undefined : onResume}
            disabled={busy}
            className="font-display font-black italic"
            style={{
              flex: 2,
              padding: "14px 0",
              borderRadius: 12,
              background: busy ? "#0a4d33" : "#14F195",
              color: "#000",
              fontSize: 13,
              letterSpacing: 1,
              border: "none",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "RESUMING..." : "RESUME ROUND →"}
          </button>
        </div>
      </div>
    </div>
  );
}
