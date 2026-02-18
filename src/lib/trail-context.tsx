"use client";

import { createContext, useReducer, useEffect, use } from "react";

type State = {
  selectedTrailId: string | null;
  visibleTrailIds: string[];
  mapLoaded: boolean;
  focusedParkCode: string | null;
  resetSignal: number;
  isLoadingPark: boolean;
};

type Action =
  | { type: "SET_SELECTED"; id: string | null }
  | { type: "SET_VISIBLE"; ids: string[] }
  | { type: "SET_MAP_LOADED" }
  | { type: "SET_FOCUSED_PARK"; code: string | null }
  | { type: "RESET_VIEW" }
  | { type: "SET_LOADING_PARK"; loading: boolean };

type Actions = {
  setSelectedTrailId: (id: string | null) => void;
  setVisibleTrailIds: (ids: string[]) => void;
  setMapLoaded: () => void;
  setFocusedParkCode: (code: string | null) => void;
  resetView: () => void;
  setLoadingPark: (loading: boolean) => void;
};

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hash.slice(1) || null;
}

function writeHash(id: string | null) {
  const url = new URL(window.location.href);
  url.hash = id ?? "";
  window.history.replaceState(null, "", url.toString());
}

function writeParkParam(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("park", code);
  else url.searchParams.delete("park");
  window.history.replaceState(null, "", url.toString());
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SELECTED":
      return { ...state, selectedTrailId: action.id };
    case "SET_VISIBLE":
      return { ...state, visibleTrailIds: action.ids, isLoadingPark: false };
    case "SET_MAP_LOADED":
      return state.mapLoaded ? state : { ...state, mapLoaded: true };
    case "SET_FOCUSED_PARK":
      return { ...state, focusedParkCode: action.code };
    case "RESET_VIEW":
      return { ...state, selectedTrailId: null, focusedParkCode: null, resetSignal: state.resetSignal + 1, isLoadingPark: false };
    case "SET_LOADING_PARK":
      return { ...state, isLoadingPark: action.loading };
  }
}

const initialState: State = {
  selectedTrailId: null,
  visibleTrailIds: [],
  mapLoaded: false,
  focusedParkCode: null,
  resetSignal: 0,
  isLoadingPark: false,
};

const StateContext = createContext<State>(initialState);
const ActionsContext = createContext<Actions | null>(null);

export function TrailProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (s) => ({
    ...s,
    selectedTrailId: readHash(),
  }));

  useEffect(() => {
    const handler = () => {
      const id = readHash();
      dispatch({ type: "SET_SELECTED", id });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const actions: Actions = {
    setSelectedTrailId(id) {
      dispatch({ type: "SET_SELECTED", id });
      writeHash(id);
    },
    setVisibleTrailIds(ids) {
      dispatch({ type: "SET_VISIBLE", ids });
    },
    setMapLoaded() {
      dispatch({ type: "SET_MAP_LOADED" });
    },
    setFocusedParkCode(code) {
      dispatch({ type: "SET_FOCUSED_PARK", code });
      writeParkParam(code);
    },
    resetView() {
      dispatch({ type: "RESET_VIEW" });
      writeHash(null);
      writeParkParam(null);
    },
    setLoadingPark(loading) {
      dispatch({ type: "SET_LOADING_PARK", loading });
    },
  };

  return (
    <StateContext value={state}>
      <ActionsContext value={actions}>
        {children}
      </ActionsContext>
    </StateContext>
  );
}

export function useTrailState() {
  return use(StateContext);
}

export function useTrailActions() {
  const ctx = use(ActionsContext);
  if (!ctx) throw new Error("useTrailActions must be used within TrailProvider");
  return ctx;
}

export function useSelectedTrailId() {
  return use(StateContext).selectedTrailId;
}

export function useVisibleTrailIds() {
  return use(StateContext).visibleTrailIds;
}

export function useMapLoaded() {
  return use(StateContext).mapLoaded;
}

export function useFocusedParkCode() {
  return use(StateContext).focusedParkCode;
}

export function useResetSignal() {
  return use(StateContext).resetSignal;
}

export function useIsLoadingPark() {
  return use(StateContext).isLoadingPark;
}
