"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Trail } from "@/lib/types";
import { useSelectedTrailId, useResetSignal, useFocusedParkCode, useTrailActions, useGroupMode } from "@/lib/trail-context";
import type { GroupMode } from "@/lib/trail-grouping";
import { Skeleton } from "@/components/ui/skeleton";

type MapViewProps = {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
  theme?: string;
  initialParkCode?: string | null;
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

const STYLE_SATELLITE = "/api/tiles/styles/alidade_satellite.json";

export const DEFAULT_CENTER: [number, number] = [-98.5, 39.8];
export const DEFAULT_ZOOM = 4.2;

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

function buildStateColorExpression(trails: Trail[]): maplibregl.ExpressionSpecification {
  const states = [...new Set(trails.map((t) => t.state))].sort();
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
        state: trail.state,
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
      paint: { "fill-color": selectedFill },
    });
  }

  if (!map.getLayer("boundaries-selected-outline")) {
    map.addLayer({
      id: "boundaries-selected-outline",
      type: "line",
      source: "boundaries",
      filter: ["==", ["get", "parkCode"], ""],
      paint: { "line-color": selectedLine, "line-width": 2.5 },
    });
  }
}

function addTrailLayers(map: maplibregl.Map, trails: Trail[], isDark: boolean) {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (!map.getSource("trails")) {
    map.addSource("trails", {
      type: "geojson",
      data: trailsToGeoJSON(trails),
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 80,
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
      minzoom: 6,
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
}

function applyGroupMode(map: maplibregl.Map, trails: Trail[], mode: GroupMode, isDark: boolean) {
  if (!map.getLayer("trails-unclustered")) return;
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (mode === "state") {
    const expr = buildStateColorExpression(trails);
    map.setPaintProperty("trails-unclustered", "circle-color", expr);
    map.setPaintProperty("trails-unclustered", "circle-stroke-color", isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)");
  } else {
    map.setPaintProperty("trails-unclustered", "circle-color", colors.unclustered);
    map.setPaintProperty("trails-unclustered", "circle-stroke-color", colors.unclusteredStroke);
  }
}

function spiderfyPoints(center: [number, number], count: number, map: maplibregl.Map): [number, number][] {
  const zoom = map.getZoom();
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
  prevVisibleKey: string;
  popup: maplibregl.Popup | null;
  groupMode: GroupMode;
  spiderfied: boolean;
};

export default function MapView({ trails, boundaries, theme, initialParkCode, ref }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const state = useRef<MapState>({
    trails,
    boundaries,
    isDark: theme === "dark",
    selectedId: null,
    prevVisibleKey: "",
    popup: null,
    groupMode: "state",
    spiderfied: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);

  const selectedId = useSelectedTrailId();
  const resetSignal = useResetSignal();
  const focusedParkCode = useFocusedParkCode();
  const groupMode = useGroupMode();
  const actions = useTrailActions();

  // Keep mutable state in sync
  state.current.trails = trails;
  state.current.boundaries = boundaries;
  state.current.isDark = theme === "dark";
  state.current.selectedId = selectedId;
  state.current.groupMode = groupMode;

  useEffect(() => {
    if (!ref) return;
    const handle: MapViewHandle = {
      zoomIn: () => mapRef.current?.zoomIn({ duration: 300 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: 300 }),
      resetNorth: () => mapRef.current?.easeTo({ bearing: 0, duration: 300 }),
      resize: () => mapRef.current?.resize(),
      getBearing: () => bearing,
      isAtDefaultView: () => {
        const map = mapRef.current;
        if (!map) return true;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const b = map.getBearing();
        return (
          Math.abs(center.lng - DEFAULT_CENTER[0]) < 0.1 &&
          Math.abs(center.lat - DEFAULT_CENTER[1]) < 0.1 &&
          Math.abs(zoom - DEFAULT_ZOOM) < 0.5 &&
          Math.abs(b) < 1
        );
      },
    };
    if (typeof ref === "function") ref(handle);
    else (ref as React.MutableRefObject<MapViewHandle | null>).current = handle;
  }, [ref, bearing]);

  // Map init
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const s = state.current;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_SATELLITE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: DEFAULT_ZOOM,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });

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

    map.on("load", () => {
      setLoaded(true);
      actions.setMapLoaded();
      addBoundaryLayers(map, s.boundaries, s.isDark);
      addTrailLayers(map, s.trails, s.isDark);
      addSpiderfyLayers(map, s.isDark);
      applyGroupMode(map, s.trails, s.groupMode, s.isDark);

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

      map.on("mouseenter", "trails-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "trails-clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "trails-unclustered", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        actions.setSelectedTrailId(feature.properties.id);
      });

      syncVisibleTrails();
    });

    map.on("style.load", () => {
      addBoundaryLayers(map, s.boundaries, s.isDark);
      addTrailLayers(map, s.trails, s.isDark);
      addSpiderfyLayers(map, s.isDark);
      applyGroupMode(map, s.trails, s.groupMode, s.isDark);
      if (s.selectedId) {
        map.setFilter("trails-selected", ["==", ["get", "id"], s.selectedId]);
      }
    });

    map.on("movestart", () => {
      if (s.spiderfied) {
        clearSpiderfy(map);
        s.spiderfied = false;
      }
    });

    map.on("idle", syncVisibleTrails);
    map.on("rotate", () => setBearing(map.getBearing()));
    map.on("mousemove", (e) => {
      setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    map.on("mouseout", () => setCursor(null));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyGroupMode(map, trails, groupMode, state.current.isDark);
  }, [groupMode, trails]);

  // Selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getLayer("trails-selected")) return;

    if (selectedId) {
      map.setFilter("trails-selected", ["==", ["get", "id"], selectedId]);
      const trail = trails.find((t) => t.id === selectedId);
      if (trail) {
        if (map.getLayer("boundaries-selected-fill")) {
          map.setFilter("boundaries-selected-fill", ["==", ["get", "parkCode"], trail.parkCode]);
          map.setFilter("boundaries-selected-outline", ["==", ["get", "parkCode"], trail.parkCode]);
        }
        map.flyTo({
          center: [trail.coordinates.lng, trail.coordinates.lat],
          zoom: 12,
          duration: 800,
        });
      }
    } else {
      map.setFilter("trails-selected", ["==", ["get", "id"], ""]);
      if (map.getLayer("boundaries-selected-fill")) {
        const parkFilter = focusedParkCode
          ? ["==", ["get", "parkCode"], focusedParkCode]
          : ["==", ["get", "parkCode"], ""];
        map.setFilter("boundaries-selected-fill", parkFilter as maplibregl.FilterSpecification);
        map.setFilter("boundaries-selected-outline", parkFilter as maplibregl.FilterSpecification);
      }
    }
  }, [selectedId, trails, focusedParkCode]);

  // Reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800 });
  }, [resetSignal]);

  // Initial park focus
  useEffect(() => {
    if (!loaded || !initialParkCode) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const parkTrails = trails.filter((t) => t.parkCode === initialParkCode);
    if (parkTrails.length === 0) return;
    const lats = parkTrails.map((t) => t.coordinates.lat);
    const lngs = parkTrails.map((t) => t.coordinates.lng);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const maxDiff = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const zoom = maxDiff > 0 ? Math.max(8, 11 - Math.log2(maxDiff + 0.1)) : 10;
    actions.setLoadingPark(true);
    map.flyTo({ center: [centerLng, centerLat], zoom, duration: 800 });
    actions.setFocusedParkCode(initialParkCode);
  }, [loaded, initialParkCode, trails]); // eslint-disable-line react-hooks/exhaustive-deps

  // Park focus changes
  useEffect(() => {
    if (!loaded || !focusedParkCode || focusedParkCode === initialParkCode) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("boundaries-selected-fill")) {
      map.setFilter("boundaries-selected-fill", ["==", ["get", "parkCode"], focusedParkCode]);
      map.setFilter("boundaries-selected-outline", ["==", ["get", "parkCode"], focusedParkCode]);
    }

    const parkTrails = trails.filter((t) => t.parkCode === focusedParkCode);
    if (parkTrails.length === 0) return;
    const lats = parkTrails.map((t) => t.coordinates.lat);
    const lngs = parkTrails.map((t) => t.coordinates.lng);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const maxDiff = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const zoom = maxDiff > 0 ? Math.max(8, 11 - Math.log2(maxDiff + 0.1)) : 10;
    map.flyTo({ center: [centerLng, centerLat], zoom, duration: 800 });
  }, [focusedParkCode, loaded, initialParkCode, trails]);

  // Clear park focus
  useEffect(() => {
    if (!loaded || focusedParkCode !== null) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("boundaries-selected-fill")) {
      map.setFilter("boundaries-selected-fill", ["==", ["get", "parkCode"], ""]);
      map.setFilter("boundaries-selected-outline", ["==", ["get", "parkCode"], ""]);
    }
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800 });
  }, [focusedParkCode, loaded]);

  return (
    <div className="relative h-full w-full">
      {!loaded && <Skeleton className="absolute inset-0 z-0 rounded-none" />}
      <div ref={mapContainer} className="h-full w-full outline-none" tabIndex={-1} />

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
