"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Trail } from "@/lib/types";
import { useSelectedTrailId, useResetSignal, useFocusedParkCode, useTrailActions } from "@/lib/trail-context";
import { Skeleton } from "@/components/ui/skeleton";

type MapViewProps = {
  trails: Trail[];
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

function addTrailLayers(map: maplibregl.Map, trails: Trail[], isDark: boolean) {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (!map.getSource("trails")) {
    map.addSource("trails", {
      type: "geojson",
      data: trailsToGeoJSON(trails),
      cluster: true,
      clusterMaxZoom: 10,
      clusterRadius: 50,
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
          "step",
          ["get", "point_count"],
          colors.clusterSteps[0],
          10, colors.clusterSteps[1],
          25, colors.clusterSteps[2],
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          12,
          10, 16,
          25, 20,
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
      paint: {
        "text-color": colors.clusterText,
      },
    });
  }

  if (!map.getLayer("trails-unclustered")) {
    map.addLayer({
      id: "trails-unclustered",
      type: "circle",
      source: "trails",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 6,
        "circle-color": colors.unclustered,
        "circle-stroke-color": colors.unclusteredStroke,
        "circle-stroke-width": 2,
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

export default function MapView({ trails, theme, initialParkCode, ref }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const prevKeyRef = useRef("");
  const trailsRef = useRef(trails);
  const isDarkRef = useRef(theme === "dark");
  const selectedIdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bearing, setBearing] = useState(0);

  const selectedId = useSelectedTrailId();
  const resetSignal = useResetSignal();
  const focusedParkCode = useFocusedParkCode();
  const actions = useTrailActions();

  useEffect(() => {
    trailsRef.current = trails;
  }, [trails]);

  useEffect(() => {
    isDarkRef.current = theme === "dark";
  }, [theme]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

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

    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

    function syncVisibleTrails() {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ids: string[] = [];
      for (const trail of trailsRef.current) {
        const { lng, lat } = trail.coordinates;
        if (
          lng >= bounds.getWest() &&
          lng <= bounds.getEast() &&
          lat >= bounds.getSouth() &&
          lat <= bounds.getNorth()
        ) {
          ids.push(trail.id);
        }
      }
      const key = ids.length + ":" + (ids[0] ?? "") + (ids[ids.length - 1] ?? "");
      if (key !== prevKeyRef.current) {
        prevKeyRef.current = key;
        actions.setVisibleTrailIds(ids);
      }
    }

    map.on("load", () => {
      setLoaded(true);
      actions.setMapLoaded();
      addTrailLayers(map, trailsRef.current, isDarkRef.current);

      map.on("click", "trails-clusters", async (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource("trails") as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: zoom + 0.5,
          duration: 300,
        });
      });

      map.on("mouseenter", "trails-unclustered", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const coords = feature.geometry.coordinates as [number, number];
        const props = feature.properties;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
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
        popupRef.current?.remove();
        popupRef.current = null;
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
      addTrailLayers(map, trailsRef.current, isDarkRef.current);
      if (selectedIdRef.current) {
        map.setFilter("trails-selected", ["==", ["get", "id"], selectedIdRef.current]);
      }
    });

    map.on("idle", syncVisibleTrails);
    map.on("rotate", () => setBearing(map.getBearing()));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getLayer("trails-selected")) return;

    if (selectedId) {
      map.setFilter("trails-selected", ["==", ["get", "id"], selectedId]);
      const trail = trails.find((t) => t.id === selectedId);
      if (trail) {
        map.flyTo({
          center: [trail.coordinates.lng, trail.coordinates.lat],
          zoom: 12,
          duration: 800,
        });
      }
    } else {
      map.setFilter("trails-selected", ["==", ["get", "id"], ""]);
    }
  }, [selectedId, trails]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800 });
  }, [resetSignal]);

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

  useEffect(() => {
    if (!loaded || !focusedParkCode || focusedParkCode === initialParkCode) return;
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
    map.flyTo({ center: [centerLng, centerLat], zoom, duration: 800 });
  }, [focusedParkCode, loaded, initialParkCode, trails]);

  useEffect(() => {
    if (!loaded || focusedParkCode !== null) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800 });
  }, [focusedParkCode, loaded]);

  return (
    <div className="relative h-full w-full">
      {!loaded && <Skeleton className="absolute inset-0 z-0 rounded-none" />}
      <div ref={mapContainer} className="h-full w-full outline-none" tabIndex={-1} />
      <div className="absolute bottom-1 right-1 z-10 text-[10px] text-muted-foreground">
        &copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">Stadia Maps</a>
        {" "}&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> contributors
      </div>
    </div>
  );
}
