import { create } from "zustand";

interface SidebarStore {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
}

export const useSidebar = create<SidebarStore>((set) => ({
  collapsed: false,
  setCollapsed: (value) => set({ collapsed: value }),
  toggle: () => set((state) => ({ collapsed: !state.collapsed })),
}));