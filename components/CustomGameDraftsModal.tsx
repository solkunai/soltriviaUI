import React, { useState } from 'react';
import type { CustomGameDraft } from '../src/utils/customGameDrafts';
import { draftDisplayName, relativeSavedAt, MAX_DRAFTS_PER_WALLET } from '../src/utils/customGameDrafts';

interface CustomGameDraftsModalProps {
  drafts: CustomGameDraft[];
  /** Called when user clicks a draft row to restore it into the wizard. */
  onRestore: (draft: CustomGameDraft) => void;
  /** Called when user clicks the X button on a draft to delete it. */
  onDelete: (draftId: string) => void;
  /** Called to dismiss the modal without restoring anything. */
  onClose: () => void;
}

const STEP_LABELS: Record<CustomGameDraft['step'], string> = {
  settings: 'Settings',
  prize: 'Prize Pool',
  questions: 'Questions',
  review: 'Review',
};

const CustomGameDraftsModal: React.FC<CustomGameDraftsModalProps> = ({ drafts, onRestore, onDelete, onClose }) => {
  // Two-step delete confirm: first tap on X sets confirmingDeleteId, second
  // tap (now visibly the red "Delete" button) actually deletes.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const requestDelete = (id: string) => setConfirmingDeleteId(id);
  const confirmDelete = (id: string) => {
    onDelete(id);
    setConfirmingDeleteId(null);
  };
  const cancelDelete = () => setConfirmingDeleteId(null);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-[1000] italic uppercase text-xl tracking-tighter">Your Drafts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
            aria-label="Close drafts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-zinc-500 text-sm">No drafts yet.</p>
            <p className="text-zinc-700 text-[10px] mt-1">Save up to {MAX_DRAFTS_PER_WALLET} unfinished games to come back to later.</p>
          </div>
        ) : (
          <>
            <p className="text-zinc-600 text-[10px] mb-3">
              {drafts.length} of {MAX_DRAFTS_PER_WALLET} saved. Tap to resume.
            </p>
            <div className="space-y-2">
              {drafts.map((d, i) => {
                const name = draftDisplayName(d, i);
                const isUntitled = !d.gameName || !d.gameName.trim();
                const isConfirming = confirmingDeleteId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`group flex items-center gap-3 rounded-xl border transition-all px-3 py-2.5 ${
                      isConfirming
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-white/[0.04] border-white/5 hover:border-[#38BDF8]/30 hover:bg-[#38BDF8]/5'
                    }`}
                  >
                    {isConfirming ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-red-400 font-[1000] italic text-sm">Delete this draft?</div>
                          <div className="text-zinc-500 text-[10px] truncate mt-0.5">"{name}"</div>
                        </div>
                        <button
                          onClick={cancelDelete}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 font-black uppercase text-[10px] tracking-wider transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmDelete(d.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-black hover:bg-red-400 font-black uppercase text-[10px] tracking-wider transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onRestore(d)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className={`font-[1000] italic text-sm truncate ${isUntitled ? 'text-zinc-500' : 'text-white'}`}>
                            {name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[#38BDF8] text-[9px] font-black uppercase tracking-wider">{STEP_LABELS[d.step]}</span>
                            <span className="text-zinc-700 text-[9px]">·</span>
                            <span className="text-zinc-600 text-[9px]">{relativeSavedAt(d.savedAt)}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => requestDelete(d.id)}
                          className="opacity-50 hover:opacity-100 w-7 h-7 rounded-full hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all flex items-center justify-center"
                          aria-label="Delete draft"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomGameDraftsModal;
