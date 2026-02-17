import { useSyncExternalStore } from "react";

type TrailStore = {
  selectedTrailId: string | null;
  resetSignal: number;
  visibleTrailIds: string[];
  setSelectedTrailId: (id: string | null) => void;
  setVisibleTrailIds: (ids: string[]) => void;
  resetView: () => void;
};

type Listener = () => void;

// Read initial trail from URL hash
function readHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  return hash || null;
}

function writeHash(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) {
    url.hash = id;
  } else {
    url.hash = "";
  }
  window.history.replaceState(null, "", url.toString());
}

let selectedTrailId: string | null = readHash();
let resetSignal = 0;
let visibleTrailIds: string[] = [];
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSelectedSnapshot() {
  return selectedTrailId;
}

function getResetSnapshot() {
  return resetSignal;
}

function getVisibleSnapshot() {
  return visibleTrailIds;
}

function getServerSnapshot() {
  return null;
}

function getServerResetSnapshot() {
  return 0;
}

const emptyIds: string[] = [];
function getServerVisibleSnapshot() {
  return emptyIds;
}

function setSelectedTrailId(id: string | null) {
  selectedTrailId = id;
  writeHash(id);
  emitChange();
}

function setVisibleTrailIds(ids: string[]) {
  visibleTrailIds = ids;
  emitChange();
}

function resetView() {
  selectedTrailId = null;
  writeHash(null);
  resetSignal++;
  emitChange();
}

// Listen for browser back/forward hash changes
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const id = readHash();
    if (id !== selectedTrailId) {
      selectedTrailId = id;
      emitChange();
    }
  });
}

export function useTrailStore<T>(selector: (s: TrailStore) => T): T {
  const selected = useSyncExternalStore(
    subscribe,
    getSelectedSnapshot,
    getServerSnapshot
  );

  const reset = useSyncExternalStore(
    subscribe,
    getResetSnapshot,
    getServerResetSnapshot
  );

  const visible = useSyncExternalStore(
    subscribe,
    getVisibleSnapshot,
    getServerVisibleSnapshot
  );

  const store: TrailStore = {
    selectedTrailId: selected,
    resetSignal: reset,
    visibleTrailIds: visible,
    setSelectedTrailId,
    setVisibleTrailIds,
    resetView,
  };

  return selector(store);
}
