import { useSyncExternalStore } from "react";

let _collapsed = false;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const emit = () => {
  for (const cb of Array.from(listeners)) cb();
};

export const setCollapsed = (v: boolean) => {
  _collapsed = v;
  emit();
};

export const toggle = () => {
  setCollapsed(!_collapsed);
};

export const useSidebar = () => {
  const collapsed = useSyncExternalStore(subscribe, () => _collapsed, () => _collapsed);
  return { collapsed, toggle, setCollapsed };
};

