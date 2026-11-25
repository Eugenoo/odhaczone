import { create } from 'zustand';

/** Transient UI state shared between screens and the tab layout (not persisted). */
type UiState = {
  /** Slides the bottom nav bar and + button out of view (e.g. while a list is being created). */
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
  /** Confetti + congratulations after finishing the last task of the day. `celebrationId` restarts it. */
  celebrating: boolean;
  celebrationId: number;
  /** Optional [title, subtitle]; a random congratulation is used when omitted. */
  celebrationMessage: [string, string] | null;
  celebrate: (message?: [string, string]) => void;
  endCelebration: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  navHidden: false,
  setNavHidden: (navHidden) => set({ navHidden }),
  celebrating: false,
  celebrationId: 0,
  celebrationMessage: null,
  celebrate: (message) =>
    set((s) => ({ celebrating: true, celebrationId: s.celebrationId + 1, celebrationMessage: message ?? null })),
  endCelebration: () => set({ celebrating: false }),
}));
