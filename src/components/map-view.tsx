"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Trail } from "@/lib/types";
import { useTrailStore } from "@/lib/store";

type MapViewProps = {
  trails: Trail[];
};

const STADIA_OUTDOORS = "https://tiles.stadiamaps.com/styles/outdoors.json";

export const DEFAULT_CENTER: [number, number] = [-98.5, 39.8];
export const DEFAULT_ZOOM = 4;

function trailsToGeoJSON(trails: Trail[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trails.map((trail) => ({
      type: "Feature",
      properties: {
        id: trail.id,
        name: trail.name,
        parkName: trail.parkName,
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

export default function MapView({ trails }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const prevKeyRef = useRef("");
  const selectedId = useTrailStore((s) => s.selectedTrailId);
  const resetSignal = useTrailStore((s) => s.resetSignal);
  const setSelected = useTrailStore((s) => s.setSelectedTrailId);
  const setVisibleTrailIds = useTrailStore((s) => s.setVisibleTrailIds);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STADIA_OUTDOORS,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: {},
      fadeDuration: 0,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    // Only show trails that are actually visible as individual dots (not inside clusters)
    function syncVisibleTrails() {
      if (!map.isStyleLoaded()) return;
      try {
        const features = map.queryRenderedFeatures(undefined, {
          layers: ["trails-unclustered"],
        });
        const ids: string[] = [];
        const seen = new Set<string>();
        for (const f of features) {
          const id = f.properties.id as string;
          if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
          }
        }
        const key = ids.length + ":" + (ids[0] ?? "") + (ids[ids.length - 1] ?? "");
        if (key !== prevKeyRef.current) {
          prevKeyRef.current = key;
          setVisibleTrailIds(ids);
        }
      } catch {
        // Layer may not exist yet
      }
    }

    map.on("load", () => {
      map.addSource("trails", {
        type: "geojson",
        data: trailsToGeoJSON(trails),
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "trails-clusters",
        type: "circle",
        source: "trails",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#16a34a",
            10, "#0d9488",
            25, "#0284c7",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            12,
            10, 16,
            25, 20,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-radius-transition": { duration: 200, delay: 0 },
          "circle-opacity-transition": { duration: 200, delay: 0 },
        },
      });

      map.addLayer({
        id: "trails-cluster-count",
        type: "symbol",
        source: "trails",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 11,
          "text-font": ["Stadia Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "trails-unclustered",
        type: "circle",
        source: "trails",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": "#16a34a",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "trails-selected",
        type: "circle",
        source: "trails",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 10,
          "circle-color": "#dc2626",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "trails-clusters", async (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource("trails") as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: zoom + 0.5,
          duration: 500,
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
        setSelected(feature.properties.id);
      });

      syncVisibleTrails();
    });

    map.on("moveend", syncVisibleTrails);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // trails is static data loaded once from JSON, callbacks are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (selectedId) {
      map.setFilter("trails-selected", ["==", ["get", "id"], selectedId]);

      const trail = trails.find((t) => t.id === selectedId);
      if (trail) {
        map.flyTo({
          center: [trail.coordinates.lng, trail.coordinates.lat],
          zoom: 12,
          duration: 1500,
        });
      }
    } else {
      map.setFilter("trails-selected", ["==", ["get", "id"], ""]);
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 1500,
      });
    }
  }, [selectedId, trails]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;

    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 1500,
    });
  }, [resetSignal]);

  return <div ref={mapContainer} className="h-full w-full" />;
}
