"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Trail } from "@/lib/types";
import { useSelectedTrailId, useResetSignal, useFocusedParkCode, useTrailActions, useGroupMode } from "@/lib/trail-context";
import type { MapStyle } from "@/lib/trail-context";
import type { GroupMode } from "@/lib/trail-grouping";
import { Skeleton } from "@/components/ui/skeleton";
import usStates from "@/data/us-states.json";

type MapViewProps = {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
  theme?: string;
  mapStyle: MapStyle;
  ref?: React.Ref<MapViewHandle>;
};

export type MapViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
  resize: () => void;
  getBearing: () => number;
  isAtDefaultView: () => boolean;
};

function getInitialIsDark(theme?: string) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function getMapStyleUrl(mapStyle: MapStyle, isDark: boolean) {
  if (mapStyle === "satellite") return "/api/tiles/styles/alidade_satellite.json";
  return isDark ? "/api/tiles/styles/alidade_smooth_dark.json" : "/api/tiles/styles/alidade_smooth.json";
}

export const DEFAULT_CENTER: [number, number] = [-98.5, 39.8];
export const DEFAULT_ZOOM = 4.2;
const SELECTED_TRAIL_ZOOM = 12;
const CLEAR_SELECTION_SCALE_FACTOR = 3;
const CLEAR_SELECTION_ZOOM_DELTA = Math.log2(CLEAR_SELECTION_SCALE_FACTOR);

function flyToDefaultView(map: maplibregl.Map, duration = 800) {
  map.stop();
  map.easeTo({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
    duration,
  });
}

function isDefaultView(map: maplibregl.Map): boolean {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();

  return (
    Math.abs(center.lng - DEFAULT_CENTER[0]) < 0.1 &&
    Math.abs(center.lat - DEFAULT_CENTER[1]) < 0.1 &&
    Math.abs(zoom - DEFAULT_ZOOM) < 0.5 &&
    Math.abs(bearing) < 1
  );
}

const LIGHT_COLORS = {
  clusterSteps: ["#16a34a", "#0d9488", "#0284c7"] as [string, string, string],
  clusterStroke: "#ffffff",
  clusterText: "#ffffff",
  unclustered: "#16a34a",
  unclusteredStroke: "#ffffff",
  selected: "#dc2626",
  selectedStroke: "#ffffff",
};

const DARK_COLORS = {
  clusterSteps: ["#4ade80", "#2dd4bf", "#38bdf8"] as [string, string, string],
  clusterStroke: "rgba(0,0,0,0.4)",
  clusterText: "#000000",
  unclustered: "#4ade80",
  unclusteredStroke: "rgba(0,0,0,0.4)",
  selected: "#f87171",
  selectedStroke: "rgba(0,0,0,0.4)",
};

// Consistent state-based color palette
const STATE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
  "#2dd4bf", "#22d3ee", "#38bdf8", "#818cf8", "#a78bfa",
  "#c084fc", "#e879f9", "#f472b6", "#fb7185", "#fdba74",
];

function stateColor(state: string): string {
  let hash = 0;
  for (let i = 0; i < state.length; i++) {
    hash = state.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STATE_COLORS[Math.abs(hash) % STATE_COLORS.length]!;
}

function primaryStateCode(rawState: string): string {
  const codes = rawState
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length === 2);

  return codes[0] ?? "UN";
}

function buildStateColorExpression(trails: Trail[]): maplibregl.ExpressionSpecification {
  const states = [...new Set(trails.map((trail) => primaryStateCode(trail.state)))].sort();
  const cases: (string | maplibregl.ExpressionSpecification)[] = [];
  for (const state of states) {
    cases.push(state, stateColor(state));
  }
  return ["match", ["get", "state"], ...cases, "#888888"] as unknown as maplibregl.ExpressionSpecification;
}

function trailsToGeoJSON(trails: Trail[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trails.map((trail) => ({
      type: "Feature",
      properties: {
        id: trail.id,
        name: trail.name,
        parkName: trail.parkName,
        parkCode: trail.parkCode,
        state: primaryStateCode(trail.state),
        difficulty: trail.difficulty,
        length: trail.length,
        elevationGain: trail.elevationGain,
      },
      geometry: {
        type: "Point",
        coordinates: [trail.coordinates.lng, trail.coordinates.lat],
      },
    })),
  };
}

function trailsToStateGeoJSON(trails: Trail[]): GeoJSON.FeatureCollection {
  return trailsToGeoJSON(trails);
}

function parksToGeoJSON(trails: Trail[]): GeoJSON.FeatureCollection {
  const byPark = new Map<string, {
    parkCode: string;
    parkName: string;
    state: string;
    count: number;
    sumLat: number;
    sumLng: number;
  }>();

  for (const trail of trails) {
    const key = trail.parkCode;
    const existing = byPark.get(key);

    if (existing) {
      existing.count += 1;
      existing.sumLat += trail.coordinates.lat;
      existing.sumLng += trail.coordinates.lng;
      continue;
    }

    byPark.set(key, {
      parkCode: trail.parkCode,
      parkName: trail.parkName,
      state: primaryStateCode(trail.state),
      count: 1,
      sumLat: trail.coordinates.lat,
      sumLng: trail.coordinates.lng,
    });
  }

  return {
    type: "FeatureCollection",
    features: [...byPark.values()].map((park) => ({
      type: "Feature",
      properties: {
        id: `park-${park.parkCode}`,
        parkCode: park.parkCode,
        parkName: park.parkName,
        state: park.state,
        trailCount: park.count,
      },
      geometry: {
        type: "Point",
        coordinates: [park.sumLng / park.count, park.sumLat / park.count],
      },
    })),
  };
}

function addBoundaryLayers(map: maplibregl.Map, boundaries: GeoJSON.FeatureCollection, isDark: boolean) {
  if (!map.getSource("boundaries")) {
    map.addSource("boundaries", {
      type: "geojson",
      data: boundaries,
    });
  }

  const fillColor = isDark ? "rgba(74, 222, 128, 0.08)" : "rgba(22, 163, 74, 0.1)";
  const lineColor = isDark ? "rgba(74, 222, 128, 0.4)" : "rgba(22, 163, 74, 0.5)";
  const selectedFill = isDark ? "rgba(74, 222, 128, 0.18)" : "rgba(22, 163, 74, 0.2)";
  const selectedLine = isDark ? "rgba(74, 222, 128, 0.7)" : "rgba(22, 163, 74, 0.8)";

  if (!map.getLayer("boundaries-fill")) {
    map.addLayer({
      id: "boundaries-fill",
      type: "fill",
      source: "boundaries",
      minzoom: 7,
      layout: {
        visibility: "none",
      },
      paint: {
        "fill-color": fillColor,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
      },
    });
  }

  if (!map.getLayer("boundaries-outline")) {
    map.addLayer({
      id: "boundaries-outline",
      type: "line",
      source: "boundaries",
      minzoom: 7,
      layout: {
        visibility: "none",
      },
      paint: {
        "line-color": lineColor,
        "line-width": 1.5,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
      },
    });
  }

  if (!map.getLayer("boundaries-selected-fill")) {
    map.addLayer({
      id: "boundaries-selected-fill",
      type: "fill",
      source: "boundaries",
      filter: ["==", ["get", "parkCode"], ""],
      layout: {
        visibility: "none",
      },
      paint: { "fill-color": selectedFill },
    });
  }

  if (!map.getLayer("boundaries-selected-outline")) {
    map.addLayer({
      id: "boundaries-selected-outline",
      type: "line",
      source: "boundaries",
      filter: ["==", ["get", "parkCode"], ""],
      layout: {
        visibility: "none",
      },
      paint: { "line-color": selectedLine, "line-width": 2.5 },
    });
  }
}

function hideBaseBoundaries(map: maplibregl.Map) {
  if (!map.getLayer("boundaries-fill")) return;
  map.setLayoutProperty("boundaries-fill", "visibility", "none");
  map.setLayoutProperty("boundaries-outline", "visibility", "none");
}

function hideSelectedBoundary(map: maplibregl.Map) {
  if (!map.getLayer("boundaries-selected-fill")) return;

  map.setLayoutProperty("boundaries-selected-fill", "visibility", "none");
  map.setLayoutProperty("boundaries-selected-outline", "visibility", "none");
  map.setFilter("boundaries-selected-fill", ["==", ["get", "parkCode"], ""] as maplibregl.FilterSpecification);
  map.setFilter("boundaries-selected-outline", ["==", ["get", "parkCode"], ""] as maplibregl.FilterSpecification);
}

function showSelectedBoundary(map: maplibregl.Map, parkCode: string) {
  if (!map.getLayer("boundaries-selected-fill")) return;

  map.setLayoutProperty("boundaries-selected-fill", "visibility", "visible");
  map.setLayoutProperty("boundaries-selected-outline", "visibility", "visible");
  map.setFilter("boundaries-selected-fill", ["==", ["get", "parkCode"], parkCode]);
  map.setFilter("boundaries-selected-outline", ["==", ["get", "parkCode"], parkCode]);
}

function addTrailLayers(map: maplibregl.Map, trails: Trail[], isDark: boolean) {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (!map.getSource("trails")) {
    map.addSource("trails", {
      type: "geojson",
      data: trailsToGeoJSON(trails),
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 48,
    });
  }

  if (!map.getSource("trails-state")) {
    map.addSource("trails-state", {
      type: "geojson",
      data: trailsToStateGeoJSON(trails),
    });
  }

  if (!map.getSource("parks")) {
    map.addSource("parks", {
      type: "geojson",
      data: parksToGeoJSON(trails),
    });
  }

  if (!map.getLayer("trails-clusters")) {
    map.addLayer({
      id: "trails-clusters",
      type: "circle",
      source: "trails",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step", ["get", "point_count"],
          colors.clusterSteps[0],
          10, colors.clusterSteps[1],
          25, colors.clusterSteps[2],
        ],
        "circle-radius": [
          "step", ["get", "point_count"],
          12, 10, 16, 25, 20,
        ],
        "circle-stroke-color": colors.clusterStroke,
        "circle-stroke-width": 1.5,
        "circle-radius-transition": { duration: 200, delay: 0 },
        "circle-opacity-transition": { duration: 200, delay: 0 },
      },
    });
  }

  if (!map.getLayer("trails-cluster-count")) {
    map.addLayer({
      id: "trails-cluster-count",
      type: "symbol",
      source: "trails",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Stadia Regular"],
        "text-size": 11,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": colors.clusterText },
    });
  }

  if (!map.getLayer("trails-unclustered")) {
    map.addLayer({
      id: "trails-unclustered",
      type: "circle",
      source: "trails",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 6],
        "circle-color": colors.unclustered,
        "circle-stroke-color": colors.unclusteredStroke,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 10, 2],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 7, 1],
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 7, 1],
      },
    });
  }

  if (!map.getLayer("trails-selected")) {
    map.addLayer({
      id: "trails-selected",
      type: "circle",
      source: "trails",
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": 10,
        "circle-color": colors.selected,
        "circle-stroke-color": colors.selectedStroke,
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer("trails-state-points")) {
    map.addLayer({
      id: "trails-state-points",
      type: "circle",
      source: "trails-state",
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          2,
          5,
          3,
          8,
          4,
          11,
          5.5,
        ],
        "circle-color": buildStateColorExpression(trails),
        "circle-stroke-color": isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 1.8],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.65, 4.5, 0.85, 7, 1],
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 4.5, 0.8, 7, 1],
      },
    });
  }

  if (!map.getLayer("parks-points")) {
    map.addLayer({
      id: "parks-points",
      type: "circle",
      source: "parks",
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          3.2,
          6,
          4.5,
          10,
          6.8,
        ],
        "circle-color": buildStateColorExpression(trails),
        "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.95)",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 10, 2.6],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.75, 5, 0.9, 7, 1],
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 5, 0.85, 7, 1],
      },
    });
  }
}

function addStateLayers(map: maplibregl.Map, isDark: boolean) {
  if (!map.getSource("us-states")) {
    map.addSource("us-states", {
      type: "geojson",
      data: usStates as unknown as GeoJSON.FeatureCollection,
    });
  }

  if (!map.getLayer("us-states-outline")) {
    map.addLayer(
      {
        id: "us-states-outline",
        type: "line",
        source: "us-states",
        paint: {
          "line-color": isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
          "line-width": 1,
        },
        layout: { visibility: "none" },
      },
      "trails-clusters",
    );
  }
}

function applyGroupMode(map: maplibregl.Map, trails: Trail[], mode: GroupMode, focusedParkCode: string | null, isDark: boolean) {
  const effectiveMode = focusedParkCode ? "park" : mode;

  if (effectiveMode === "state") {
    if (map.getLayer("trails-clusters")) {
      map.setLayoutProperty("trails-clusters", "visibility", "none");
    }
    if (map.getLayer("trails-cluster-count")) {
      map.setLayoutProperty("trails-cluster-count", "visibility", "none");
    }
    if (map.getLayer("trails-unclustered")) {
      map.setLayoutProperty("trails-unclustered", "visibility", "none");
    }
    if (map.getLayer("trails-state-points")) {
      map.setLayoutProperty("trails-state-points", "visibility", "visible");
      map.setPaintProperty("trails-state-points", "circle-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        2,
        5,
        3,
        8,
        4,
        11,
        5.5,
      ]);
      map.setPaintProperty("trails-state-points", "circle-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.65,
        4.5,
        0.85,
        7,
        1,
      ]);
      map.setPaintProperty("trails-state-points", "circle-stroke-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.6,
        4.5,
        0.8,
        7,
        1,
      ]);
      map.setPaintProperty("trails-state-points", "circle-stroke-width", ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 1.8]);
      const expr = buildStateColorExpression(trails);
      map.setPaintProperty("trails-state-points", "circle-color", expr);
      map.setPaintProperty("trails-state-points", "circle-stroke-color", isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)");
    }
    if (map.getLayer("parks-points")) {
      map.setLayoutProperty("parks-points", "visibility", "none");
    }
  } else {
    if (map.getLayer("trails-clusters")) {
      map.setLayoutProperty("trails-clusters", "visibility", "none");
    }
    if (map.getLayer("trails-cluster-count")) {
      map.setLayoutProperty("trails-cluster-count", "visibility", "none");
    }
    if (map.getLayer("trails-unclustered")) {
      map.setLayoutProperty("trails-unclustered", "visibility", "none");
    }
    if (map.getLayer("trails-state-points")) {
      map.setLayoutProperty("trails-state-points", "visibility", "none");
    }
    if (map.getLayer("parks-points")) {
      map.setLayoutProperty("parks-points", "visibility", "visible");
      const expr = buildStateColorExpression(trails);
      map.setPaintProperty("parks-points", "circle-color", expr);
      map.setPaintProperty("parks-points", "circle-stroke-color", isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.95)");
    }
  }

  if (map.getLayer("us-states-outline")) {
    map.setLayoutProperty("us-states-outline", "visibility", "visible");
  }
}

function spiderfyPoints(center: [number, number], count: number, map: maplibregl.Map): [number, number][] {
  const radiusPx = count <= 8 ? 30 : 30 + (count - 8) * 3;
  const centerPx = map.project(center);
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const px = new maplibregl.Point(
      centerPx.x + radiusPx * Math.cos(angle),
      centerPx.y + radiusPx * Math.sin(angle)
    );
    const lngLat = map.unproject(px);
    points.push([lngLat.lng, lngLat.lat]);
  }
  return points;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function addSpiderfyLayers(map: maplibregl.Map, isDark: boolean) {
  if (!map.getSource("spiderfy")) {
    map.addSource("spiderfy", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("spiderfy-legs")) {
    map.addSource("spiderfy-legs", { type: "geojson", data: EMPTY_FC });
  }
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (!map.getLayer("spiderfy-legs")) {
    map.addLayer({
      id: "spiderfy-legs",
      type: "line",
      source: "spiderfy-legs",
      paint: {
        "line-color": isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.25)",
        "line-width": 1,
      },
    });
  }
  if (!map.getLayer("spiderfy-points")) {
    map.addLayer({
      id: "spiderfy-points",
      type: "circle",
      source: "spiderfy",
      paint: {
        "circle-radius": 7,
        "circle-color": colors.unclustered,
        "circle-stroke-color": colors.unclusteredStroke,
        "circle-stroke-width": 2,
      },
    });
  }
}

function clearSpiderfy(map: maplibregl.Map) {
  const src = map.getSource("spiderfy") as maplibregl.GeoJSONSource | undefined;
  const legSrc = map.getSource("spiderfy-legs") as maplibregl.GeoJSONSource | undefined;
  src?.setData(EMPTY_FC);
  legSrc?.setData(EMPTY_FC);
}

// Consolidate mutable state that needs to be read inside imperative map callbacks
type MapState = {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
  isDark: boolean;
  selectedId: string | null;
  selectedZoomBaseline: number | null;
  prevVisibleKey: string;
  popup: maplibregl.Popup | null;
  groupMode: GroupMode;
  spiderfied: boolean;
  focusedParkCode: string | null;
};

export default function MapView({ trails, boundaries, theme, mapStyle, ref }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialIsDark = getInitialIsDark(theme);
  const currentStyleUrlRef = useRef(getMapStyleUrl(mapStyle, initialIsDark));
  const state = useRef<MapState>({
    trails,
    boundaries,
    isDark: initialIsDark,
    selectedId: null,
    selectedZoomBaseline: null,
    prevVisibleKey: "",
    popup: null,
    groupMode: "state",
    spiderfied: false,
    focusedParkCode: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const cursorFrameRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ lng: number; lat: number } | null>(null);

  const selectedId = useSelectedTrailId();
  const resetSignal = useResetSignal();
  const focusedParkCode = useFocusedParkCode();
  const groupMode = useGroupMode();
  const actions = useTrailActions();

  useEffect(() => {
    state.current.trails = trails;
    state.current.boundaries = boundaries;
    state.current.isDark = getInitialIsDark(theme);
    state.current.selectedId = selectedId;
    state.current.groupMode = groupMode;
    state.current.focusedParkCode = focusedParkCode;
  }, [trails, boundaries, theme, selectedId, groupMode, focusedParkCode]);

  useEffect(() => {
    if (!ref) return;
    const handle: MapViewHandle = {
      zoomIn: () => mapRef.current?.zoomIn({ duration: 300 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: 300 }),
      resetNorth: () => mapRef.current?.easeTo({ bearing: 0, duration: 300 }),
      resize: () => mapRef.current?.resize(),
      getBearing: () => mapRef.current?.getBearing() ?? 0,
      isAtDefaultView: () => {
        const map = mapRef.current;
        if (!map) return true;
        return isDefaultView(map);
      },
    };
    if (typeof ref === "function") ref(handle);
    else (ref as React.MutableRefObject<MapViewHandle | null>).current = handle;
  }, [ref]);

  // Map init
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const s = state.current;

    function hideSelectedBoundaryIfUnselected() {
      if (s.selectedId !== null) return;
      hideSelectedBoundary(map);
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: currentStyleUrlRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: DEFAULT_ZOOM,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });

    function emitViewState() {
      hideSelectedBoundaryIfUnselected();

      actions.setMapView({
        bearing: map.getBearing(),
        isAtDefault: isDefaultView(map),
      });
    }

    function syncVisibleTrails() {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ids: string[] = [];
      for (const trail of s.trails) {
        const { lng, lat } = trail.coordinates;
        if (lng >= bounds.getWest() && lng <= bounds.getEast() && lat >= bounds.getSouth() && lat <= bounds.getNorth()) {
          ids.push(trail.id);
        }
      }
      const key = ids.length + ":" + (ids[0] ?? "") + (ids[ids.length - 1] ?? "");
      if (key !== s.prevVisibleKey) {
        s.prevVisibleKey = key;
        actions.setVisibleTrailIds(ids);
      }
    }

    function scheduleCursorUpdate(nextCursor: { lng: number; lat: number }) {
      pendingCursorRef.current = nextCursor;
      if (cursorFrameRef.current !== null) return;

      cursorFrameRef.current = window.requestAnimationFrame(() => {
        cursorFrameRef.current = null;
        setCursor(pendingCursorRef.current);
      });
    }

    map.on("load", () => {
      setLoaded(true);
      actions.setMapLoaded();
      addBoundaryLayers(map, s.boundaries, s.isDark);
      addTrailLayers(map, s.trails, s.isDark);
      addStateLayers(map, s.isDark);
      addSpiderfyLayers(map, s.isDark);
      applyGroupMode(map, s.trails, s.groupMode, s.focusedParkCode, s.isDark);
      emitViewState();


      map.on("click", "trails-clusters", async (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource("trails") as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const center = feature.geometry.coordinates as [number, number];

        if (zoom >= 12) {
          // At max cluster zoom — spiderfy instead of zooming
          const leaves = await source.getClusterLeaves(clusterId, 20, 0);
          const positions = spiderfyPoints(center, leaves.length, map);
          const spiderFeatures: GeoJSON.Feature[] = leaves.map((leaf, i) => ({
            type: "Feature",
            properties: { ...leaf.properties },
            geometry: { type: "Point", coordinates: positions[i]! },
          }));
          const legFeatures: GeoJSON.Feature[] = leaves.map((_, i) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [center, positions[i]!] },
          }));
          (map.getSource("spiderfy") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: spiderFeatures,
          });
          (map.getSource("spiderfy-legs") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: legFeatures,
          });
          s.spiderfied = true;
        } else {
          clearSpiderfy(map);
          s.spiderfied = false;
          map.easeTo({ center, zoom: zoom + 0.5, duration: 300 });
        }
      });

      map.on("click", "spiderfy-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        actions.setSelectedTrailId(feature.properties.id);
      });

      map.on("mouseenter", "spiderfy-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const coords = feature.geometry.coordinates as [number, number];
        const props = feature.properties;
        s.popup?.remove();
        s.popup = new maplibregl.Popup({
          offset: 12,
          closeButton: false,
          closeOnClick: false,
          className: "trail-popup",
        })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;font-weight:500;max-width:200px">${props.name}</div>
             <div style="font-size:10px;color:#666;margin-top:2px">${props.parkName}</div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "spiderfy-points", () => {
        map.getCanvas().style.cursor = "";
        s.popup?.remove();
        s.popup = null;
      });

      map.on("mouseenter", "trails-unclustered", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const coords = feature.geometry.coordinates as [number, number];
        const props = feature.properties;
        s.popup?.remove();
        s.popup = new maplibregl.Popup({
          offset: 12,
          closeButton: false,
          closeOnClick: false,
          className: "trail-popup",
        })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;font-weight:500;max-width:200px">${props.name}</div>
             <div style="font-size:10px;color:#666;margin-top:2px">${props.parkName}</div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "trails-unclustered", () => {
        map.getCanvas().style.cursor = "";
        s.popup?.remove();
        s.popup = null;
      });

      map.on("mouseenter", "trails-state-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const coords = feature.geometry.coordinates as [number, number];
        const props = feature.properties;
        s.popup?.remove();
        s.popup = new maplibregl.Popup({
          offset: 12,
          closeButton: false,
          closeOnClick: false,
          className: "trail-popup",
        })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;font-weight:500;max-width:200px">${props.name}</div>
             <div style="font-size:10px;color:#666;margin-top:2px">${props.parkName}</div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "trails-state-points", () => {
        map.getCanvas().style.cursor = "";
        s.popup?.remove();
        s.popup = null;
      });

      map.on("mouseenter", "parks-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const coords = feature.geometry.coordinates as [number, number];
        const props = feature.properties;
        const trailCount = Number.parseInt(String(props.trailCount ?? "0"), 10);

        s.popup?.remove();
        s.popup = new maplibregl.Popup({
          offset: 12,
          closeButton: false,
          closeOnClick: false,
          className: "trail-popup",
        })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;font-weight:600;max-width:220px">${props.parkName}</div>
             <div style="font-size:10px;color:#666;margin-top:2px">${trailCount} ${trailCount === 1 ? "trail" : "trails"}</div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "parks-points", () => {
        map.getCanvas().style.cursor = "";
        s.popup?.remove();
        s.popup = null;
      });

      map.on("mouseenter", "trails-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "trails-clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "trails-unclustered", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        if (s.groupMode === "park") {
          const parkCode = String(feature.properties.parkCode ?? "").toLowerCase();
          if (!parkCode) return;
          actions.setSelectedTrailId(null);
          actions.setGroupMode("park");
          actions.setFocusedParkCode(parkCode);
          return;
        }
        actions.setSelectedTrailId(feature.properties.id);
      });

      map.on("click", "trails-state-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        if (s.groupMode === "park") {
          const parkCode = String(feature.properties.parkCode ?? "").toLowerCase();
          if (!parkCode) return;
          actions.setSelectedTrailId(null);
          actions.setGroupMode("park");
          actions.setFocusedParkCode(parkCode);
          return;
        }
        actions.setSelectedTrailId(feature.properties.id);
      });

      map.on("click", "parks-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const parkCode = String(feature.properties.parkCode ?? "").toLowerCase();
        if (!parkCode) return;

        actions.setSelectedTrailId(null);
        actions.setGroupMode("park");
        actions.setFocusedParkCode(parkCode);
      });

      syncVisibleTrails();
    });

    map.on("style.load", () => {
      addBoundaryLayers(map, s.boundaries, s.isDark);
      addTrailLayers(map, s.trails, s.isDark);
      addStateLayers(map, s.isDark);
      addSpiderfyLayers(map, s.isDark);
      applyGroupMode(map, s.trails, s.groupMode, s.focusedParkCode, s.isDark);
      hideBaseBoundaries(map);
      if (s.selectedId) {
        map.setFilter("trails-selected", ["==", ["get", "id"], s.selectedId]);
        const selectedTrail = s.trails.find((trail) => trail.id === s.selectedId);
        if (selectedTrail) {
          showSelectedBoundary(map, selectedTrail.parkCode);
        }
      } else {
        hideSelectedBoundary(map);
      }
    });

    map.on("movestart", () => {
      if (s.spiderfied) {
        clearSpiderfy(map);
        s.spiderfied = false;
      }
    });

    map.on("idle", syncVisibleTrails);
    map.on("rotate", emitViewState);
    map.on("moveend", emitViewState);
    map.on("zoom", () => {
      const currentSelectedId = s.selectedId;
      const baseline = s.selectedZoomBaseline;

      if (
        currentSelectedId &&
        baseline !== null &&
        map.getZoom() <= baseline - CLEAR_SELECTION_ZOOM_DELTA
      ) {
        s.selectedId = null;
        s.selectedZoomBaseline = null;

        map.setFilter("trails-selected", ["==", ["get", "id"], ""]);
        hideSelectedBoundary(map);

        applyGroupMode(map, s.trails, s.groupMode, s.focusedParkCode, s.isDark);
        flyToDefaultView(map, 450);

        actions.resetView();
      }
    });

    map.on("zoomend", () => {
      emitViewState();
    });
    map.on("mousemove", (e) => {
      scheduleCursorUpdate({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    map.on("mouseout", () => {
      pendingCursorRef.current = null;
      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
        cursorFrameRef.current = null;
      }
      setCursor(null);
    });

    mapRef.current = map;

    return () => {
      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const nextStyleUrl = getMapStyleUrl(mapStyle, getInitialIsDark(theme));
    if (currentStyleUrlRef.current === nextStyleUrl) return;

    currentStyleUrlRef.current = nextStyleUrl;
    map.setStyle(nextStyleUrl);
  }, [mapStyle, theme, loaded]);

  // Group mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    applyGroupMode(map, trails, groupMode, focusedParkCode, state.current.isDark);
  }, [groupMode, trails, selectedId, focusedParkCode]);

  // Selection — hide unrelated layers when a trail is selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getLayer("trails-selected")) return;

    if (selectedId) {
      clearSpiderfy(map);
      state.current.spiderfied = false;

      map.setFilter("trails-selected", ["==", ["get", "id"], selectedId]);
      const trail = trails.find((t) => t.id === selectedId);
      if (trail) {
        showSelectedBoundary(map, trail.parkCode);
        map.flyTo({
          center: [trail.coordinates.lng, trail.coordinates.lat],
          zoom: SELECTED_TRAIL_ZOOM,
          duration: 800,
        });
        const capturedId = selectedId;
        map.once("moveend", () => {
          if (state.current.selectedId === capturedId) {
            state.current.selectedZoomBaseline = map.getZoom();
          }
        });
      }
    } else {
      state.current.selectedZoomBaseline = null;

      map.setFilter("trails-selected", ["==", ["get", "id"], ""]);
      hideSelectedBoundary(map);
      applyGroupMode(map, trails, state.current.groupMode, state.current.focusedParkCode, state.current.isDark);
    }
  }, [selectedId, trails, focusedParkCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const trailsSource = map.getSource("trails") as maplibregl.GeoJSONSource | undefined;
    trailsSource?.setData(trailsToGeoJSON(trails));

    const stateTrailsSource = map.getSource("trails-state") as maplibregl.GeoJSONSource | undefined;
    stateTrailsSource?.setData(trailsToStateGeoJSON(trails));

    const parksSource = map.getSource("parks") as maplibregl.GeoJSONSource | undefined;
    parksSource?.setData(parksToGeoJSON(trails));

    const boundariesSource = map.getSource("boundaries") as maplibregl.GeoJSONSource | undefined;
    boundariesSource?.setData(boundaries);
  }, [trails, boundaries]);

  // Reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;
    flyToDefaultView(map, 800);
  }, [resetSignal]);

  // Park focus changes
  useEffect(() => {
    if (!loaded || !focusedParkCode) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const parkTrails = trails.filter((t) => t.parkCode === focusedParkCode);
    if (parkTrails.length === 0) return;
    const lats = parkTrails.map((t) => t.coordinates.lat);
    const lngs = parkTrails.map((t) => t.coordinates.lng);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const maxDiff = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const zoom = maxDiff > 0 ? Math.max(8, 11 - Math.log2(maxDiff + 0.1)) : 10;
    actions.setLoadingPark(true);
    actions.setGroupMode("park");
    map.flyTo({ center: [centerLng, centerLat], zoom, duration: 800 });
  }, [focusedParkCode, loaded, trails]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear park focus
  useEffect(() => {
    if (!loaded || focusedParkCode !== null) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    flyToDefaultView(map, 800);
  }, [focusedParkCode, loaded]);

  return (
    <div className="relative h-full w-full">
      {!loaded && <Skeleton className="absolute inset-0 z-0 rounded-none" />}
      <div ref={mapContainer} className="h-full w-full bg-zinc-100 outline-none dark:bg-zinc-950" tabIndex={-1} />

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between px-3 pb-2 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="pointer-events-auto rounded-md bg-background/80 backdrop-blur-sm border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
            {cursor ? (
              <span>
                {cursor.lat.toFixed(4)}, {cursor.lng.toFixed(4)}
              </span>
            ) : (
              <span className="text-muted-foreground/50">Move cursor</span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground pointer-events-auto">
          &copy;{" "}
          <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Stadia Maps
          </a>{" "}
          &copy;{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
            OpenStreetMap
          </a>
        </div>
      </div>
    </div>
  );
}
