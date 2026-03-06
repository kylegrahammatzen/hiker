"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Trail } from "@/lib/types";

const STYLE_SATELLITE = "/api/tiles/styles/alidade_satellite.json";
const CENTER: [number, number] = [-98.5, 39.8];
const ZOOM = 3.5;

const STATE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
  "#2dd4bf", "#22d3ee", "#38bdf8", "#818cf8", "#a78bfa",
  "#c084fc", "#e879f9", "#f472b6", "#fb7185", "#fdba74",
];

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  VI: "Virgin Islands", AS: "American Samoa", GU: "Guam", PR: "Puerto Rico",
  MP: "Northern Mariana Islands", DC: "District of Columbia",
};

function stateColor(state: string): string {
  let hash = 0;
  for (let i = 0; i < state.length; i++) {
    hash = state.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STATE_COLORS[Math.abs(hash) % STATE_COLORS.length]!;
}

function expandStateName(abbr: string): string {
  if (abbr.includes(",")) {
    return abbr
      .split(",")
      .map((s) => STATE_NAMES[s.trim()] ?? s.trim())
      .join(", ");
  }
  return STATE_NAMES[abbr] ?? abbr;
}

function buildStateColorExpression(trails: Trail[]): maplibregl.ExpressionSpecification {
  const states = [...new Set(trails.map((t) => t.state))].sort();
  const cases: (string | maplibregl.ExpressionSpecification)[] = [];
  for (const state of states) {
    cases.push(state, stateColor(state));
  }
  return ["match", ["get", "state"], ...cases, "#888888"] as unknown as maplibregl.ExpressionSpecification;
}

type Props = {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
};

export function RenderMap({ trails, boundaries }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  const stateEntries = [...new Set(trails.map((t) => t.state))]
    .sort()
    .map((s) => ({ abbr: s, name: expandStateName(s), color: stateColor(s) }));

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_SATELLITE,
      center: CENTER,
      zoom: ZOOM,
      minZoom: 2,
      attributionControl: false,
      interactive: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });

    map.on("load", () => {
      setLoaded(true);

      map.addSource("boundaries", { type: "geojson", data: boundaries });
      map.addLayer({
        id: "boundaries-fill",
        type: "fill",
        source: "boundaries",
        minzoom: 7,
        paint: {
          "fill-color": "rgba(74, 222, 128, 0.08)",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
        },
      });
      map.addLayer({
        id: "boundaries-outline",
        type: "line",
        source: "boundaries",
        minzoom: 7,
        paint: {
          "line-color": "rgba(74, 222, 128, 0.4)",
          "line-width": 1.5,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
        },
      });

      const geojson: GeoJSON.FeatureCollection = {
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
          },
          geometry: {
            type: "Point",
            coordinates: [trail.coordinates.lng, trail.coordinates.lat],
          },
        })),
      };

      map.addSource("trails", { type: "geojson", data: geojson });

      const colorExpr = buildStateColorExpression(trails);
      map.addLayer({
        id: "trails-points",
        type: "circle",
        source: "trails",
        paint: {
          "circle-radius": 5,
          "circle-color": colorExpr,
          "circle-stroke-color": "rgba(0,0,0,0.5)",
          "circle-stroke-width": 1.5,
        },
      });

      map.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }), "bottom-left");
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [trails, boundaries]);

  return (
    <div className="flex h-svh w-full bg-background">
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-border px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Exploring the Trails and Nature of America's National Parks
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Kyle Graham Matzen
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Legend
          </h2>

          <div className="mt-3 flex flex-col gap-1">
            <p className="text-[11px] font-medium text-foreground">Trails by State</p>
            <div className="mt-1 grid grid-cols-1 gap-0.5">
              {stateEntries.map((entry) => (
                <div key={entry.abbr} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-black/20"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[11px] text-foreground/80 leading-tight">
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium text-foreground">Map Layers</p>
            <div className="mt-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm border border-black/20 bg-emerald-500/20" />
                <span className="text-[11px] text-foreground/80">Park Boundaries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm bg-white/60 border border-white/40" />
                <span className="text-[11px] text-foreground/80">Satellite Basemap</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium text-foreground">Data Sources</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-[10px] text-muted-foreground leading-snug">
              <li>NPS API (developer.nps.gov)</li>
              <li>NPS ArcGIS FeatureServer</li>
              <li>National Weather Service API</li>
              <li>iNaturalist API</li>
              <li>Stadia Maps Satellite Tiles</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <p className="text-[10px] text-muted-foreground leading-snug">
            {trails.length} trails across {new Set(trails.map((t) => t.parkCode)).size} parks
          </p>
          <p className="text-[10px] text-muted-foreground">
            Stadia Maps / OpenStreetMap
          </p>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mapContainer} className="h-full w-full" />

        <div className="absolute top-3 right-3 z-10">
          <svg viewBox="0 0 100 100" className="size-14 drop-shadow-md">
            <polygon points="50,8 42,48 58,48" fill="#dc2626" stroke="white" strokeWidth="1" />
            <polygon points="50,92 42,52 58,52" fill="white" fillOpacity="0.7" stroke="white" strokeWidth="1" />
            <polygon points="92,50 52,42 52,58" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.5" />
            <polygon points="8,50 48,42 48,58" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="4" fill="white" stroke="white" strokeWidth="1" />
            <text x="50" y="7" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui">N</text>
            <text x="50" y="99" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">S</text>
            <text x="97" y="53" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">E</text>
            <text x="3" y="53" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">W</text>
          </svg>
        </div>

        <div className="absolute bottom-2 right-2 z-10 text-[9px] text-white/70">
          Stadia Maps / OpenStreetMap
        </div>
      </div>
    </div>
  );
}
