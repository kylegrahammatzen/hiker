import { useSyncExternalStore } from "react";

type Listener = () => void;

let selectedTrailId: string | null = null;
let resetSignal = 0;
let visibleTrailIds: string[] = [];
let mapLoaded = false;
let focusedParkCode: string | null = null;

const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  return hash || null;
}

function writeHash(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = id ?? "";
  window.history.replaceState(null, "", url.toString());
}

function writeParkParam(parkCode: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (parkCode) {
    url.searchParams.set("park", parkCode);
  } else {
    url.searchParams.delete("park");
  }
  window.history.replaceState(null, "", url.toString());
}

if (typeof window !== "undefined") {
  selectedTrailId = readHash();
  window.addEventListener("hashchange", () => {
    const id = readHash();
    if (id !== selectedTrailId) {
      selectedTrailId = id;
      emitChange();
    }
  });
}

function getSelectedId() { return selectedTrailId; }
function getResetSignal() { return resetSignal; }
function getVisibleIds() { return visibleTrailIds; }
function getMapLoaded() { return mapLoaded; }
function getFocusedParkCode() { return focusedParkCode; }

const SERVER_EMPTY: string[] = [];

export function useSelectedTrailId() {
  return useSyncExternalStore(subscribe, getSelectedId, () => null);
}

export function useResetSignal() {
  return useSyncExternalStore(subscribe, getResetSignal, () => 0);
}

export function useVisibleTrailIds() {
  return useSyncExternalStore(subscribe, getVisibleIds, () => SERVER_EMPTY);
}

export function useMapLoaded() {
  return useSyncExternalStore(subscribe, getMapLoaded, () => false);
}

export function useFocusedParkCode() {
  return useSyncExternalStore(subscribe, getFocusedParkCode, () => null);
}

export const trailActions = {
  setSelectedTrailId(id: string | null) {
    selectedTrailId = id;
    writeHash(id);
    emitChange();
  },
  setVisibleTrailIds(ids: string[]) {
    visibleTrailIds = ids;
    emitChange();
  },
  setMapLoaded() {
    if (mapLoaded) return;
    mapLoaded = true;
    emitChange();
  },
  setFocusedParkCode(parkCode: string | null) {
    focusedParkCode = parkCode;
    writeParkParam(parkCode);
    emitChange();
  },
  resetView() {
    selectedTrailId = null;
    focusedParkCode = null;
    writeHash(null);
    writeParkParam(null);
    resetSignal++;
    emitChange();
  },
} as const;
