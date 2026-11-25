import { create } from 'zustand';

/** Transient UI state shared between screens and the tab layout (not persisted). */
type UiState = {
  /** Slides the bottom nav bar and + button out of view (e.g. while a list is being created). */
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  navHidden: false,
  setNavHidden: (navHidden) => set({ navHidden }),
}));
