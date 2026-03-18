"use client";

import { useEffect, useMemo, useState } from "react";
import usStatesData from "@/data/us-states.json";
import type { Trail } from "@/lib/types";

const DISPLAYED_STATE_ABBRS = new Set<string>([
  "AL",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  VI: "Virgin Islands",
  AS: "American Samoa",
  GU: "Guam",
  PR: "Puerto Rico",
  MP: "Northern Mariana Islands",
  DC: "District of Columbia",
};

const STATE_ABBR_BY_NAME = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([abbr, name]) => [name, abbr]),
) as Record<string, string>;

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 620;

type Bounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

type StateFeatureProps = GeoJSON.GeoJsonProperties & {
  name: string;
  abbr: string;
  trailCount: number;
};

type StateGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type StateFeature = GeoJSON.Feature<StateGeometry, StateFeatureProps>;

function splitStateCodes(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function buildTrailCountByState(trails: Trail[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const trail of trails) {
    for (const code of splitStateCodes(trail.state)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return counts;
}

function isStateGeometry(geometry: GeoJSON.Geometry): geometry is StateGeometry {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function buildStateFeatures(trailCounts: Map<string, number>): StateFeature[] {
  const source =
    usStatesData as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name?: string }>;

  const features: StateFeature[] = [];

  for (const feature of source.features) {
    const name = feature.properties?.name ?? "";
    const abbr = STATE_ABBR_BY_NAME[name] ?? "";

    if (!DISPLAYED_STATE_ABBRS.has(abbr)) continue;
    if (!feature.geometry || !isStateGeometry(feature.geometry)) continue;

    features.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        name,
        abbr,
        trailCount: trailCounts.get(abbr) ?? 0,
      },
    });
  }

  return features;
}

function stateHue(abbr: string): number {
  const a = abbr.charCodeAt(0) || 65;
  const b = abbr.charCodeAt(1) || 65;
  return (a * 47 + b * 89) % 360;
}

function colorForState(abbr: string, tone: "base" | "selected" = "base"): string {
  const hue = stateHue(abbr);

  if (tone === "selected") {
    return `hsl(${hue} 84% 68%)`;
  }

  return `hsl(${hue} 62% 52%)`;
}

function expandBounds(bounds: Bounds | null, lng: number, lat: number): Bounds {
  if (!bounds) {
    return {
      minLng: lng,
      minLat: lat,
      maxLng: lng,
      maxLat: lat,
    };
  }

  return {
    minLng: Math.min(bounds.minLng, lng),
    minLat: Math.min(bounds.minLat, lat),
    maxLng: Math.max(bounds.maxLng, lng),
    maxLat: Math.max(bounds.maxLat, lat),
  };
}

function boundsFromGeometry(geometry: StateGeometry): Bounds | null {
  let bounds: Bounds | null = null;

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const [lng, lat] of ring) {
        bounds = expandBounds(bounds, lng, lat);
      }
    }
    return bounds;
  }

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        bounds = expandBounds(bounds, lng, lat);
      }
    }
  }

  return bounds;
}

function boundsFromCollection(features: StateFeature[]): Bounds | null {
  let bounds: Bounds | null = null;

  for (const feature of features) {
    const featureBounds = boundsFromGeometry(feature.geometry);
    if (!featureBounds) continue;

    bounds = bounds
      ? {
          minLng: Math.min(bounds.minLng, featureBounds.minLng),
          minLat: Math.min(bounds.minLat, featureBounds.minLat),
          maxLng: Math.max(bounds.maxLng, featureBounds.maxLng),
          maxLat: Math.max(bounds.maxLat, featureBounds.maxLat),
        }
      : featureBounds;
  }

  return bounds;
}

function makeProjector(
  bounds: Bounds,
  viewPadding: number,
  verticalAlign: "center" | "top" = "center",
) {
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.00001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.00001);

  const availableWidth = VIEWBOX_WIDTH - viewPadding * 2;
  const availableHeight = VIEWBOX_HEIGHT - viewPadding * 2;

  const scale = Math.min(availableWidth / lngSpan, availableHeight / latSpan);

  const drawnWidth = lngSpan * scale;
  const drawnHeight = latSpan * scale;

  const offsetX = (VIEWBOX_WIDTH - drawnWidth) / 2;
  const offsetY =
    verticalAlign === "top" ? viewPadding : (VIEWBOX_HEIGHT - drawnHeight) / 2;

  return (lng: number, lat: number) => {
    const x = offsetX + (lng - bounds.minLng) * scale;
    const y = offsetY + (bounds.maxLat - lat) * scale;
    return [x, y] as const;
  };
}

function ringToPath(
  ring: number[][],
  project: (lng: number, lat: number) => readonly [number, number],
): string {
  if (!ring.length) return "";

  const commands: string[] = [];

  for (let i = 0; i < ring.length; i += 1) {
    const [lng, lat] = ring[i];
    const [x, y] = project(lng, lat);
    commands.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

function geometryToPath(
  geometry: StateGeometry,
  project: (lng: number, lat: number) => readonly [number, number],
): string {
  const segments: string[] = [];

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      const segment = ringToPath(ring, project);
      if (segment) segments.push(segment);
    }
    return segments.join(" ");
  }

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      const segment = ringToPath(ring, project);
      if (segment) segments.push(segment);
    }
  }

  return segments.join(" ");
}

type DetailProps = {
  feature: StateFeature | null;
};

function StateDetailSvg({ feature }: DetailProps) {
  const baseFill = feature ? colorForState(feature.properties.abbr, "base") : "#94a3b8";

  const path = useMemo(() => {
    if (!feature) return "";

    const bounds = boundsFromGeometry(feature.geometry);
    if (!bounds) return "";

    const project = makeProjector(bounds, 8);
    return geometryToPath(feature.geometry, project);
  }, [feature]);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Selected state"
    >
      {path ? (
        <path
          d={path}
          fill={baseFill}
          stroke="hsl(var(--foreground))"
          strokeWidth={2.4}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

type OverviewProps = {
  features: StateFeature[];
  selectedStateAbbr: string;
  onSelectState: (abbr: string) => void;
};

function UsOverviewSvg({ features, selectedStateAbbr, onSelectState }: OverviewProps) {
  const projected = useMemo(() => {
    const bounds = boundsFromCollection(features);
    if (!bounds) return [] as Array<{ abbr: string; path: string; trailCount: number }>;

    const project = makeProjector(bounds, 8, "top");

    return features.map((feature) => ({
      abbr: feature.properties.abbr,
      trailCount: feature.properties.trailCount,
      path: geometryToPath(feature.geometry, project),
    }));
  }, [features]);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="United States overview"
    >
      {projected.map((state) => {
        const selected = state.abbr === selectedStateAbbr;
        const fill = selected
          ? colorForState(state.abbr, "selected")
          : colorForState(state.abbr, "base");

        return (
          <path
            key={state.abbr}
            d={state.path}
            fill={fill}
            stroke={selected ? "hsl(var(--foreground))" : "rgba(226,232,240,0.65)"}
            strokeWidth={selected ? 2.6 : 1.05}
            fillOpacity={selected ? 1 : 0.92}
            vectorEffect="non-scaling-stroke"
            className="cursor-pointer"
            onClick={() => onSelectState(state.abbr)}
          />
        );
      })}
    </svg>
  );
}

type Props = {
  trails: Trail[];
};

export function VisualMap({ trails }: Props) {
  const trailCounts = useMemo(() => buildTrailCountByState(trails), [trails]);

  const stateFeatures = useMemo(() => buildStateFeatures(trailCounts), [trailCounts]);

  const defaultStateAbbr = useMemo(() => {
    if (!stateFeatures.length) return "";

    const ranked = [...stateFeatures].sort(
      (a, b) => b.properties.trailCount - a.properties.trailCount,
    );

    return ranked[0]?.properties.abbr ?? stateFeatures[0].properties.abbr;
  }, [stateFeatures]);

  const [selectedStateAbbr, setSelectedStateAbbr] = useState("");

  useEffect(() => {
    if (!selectedStateAbbr && defaultStateAbbr) {
      setSelectedStateAbbr(defaultStateAbbr);
    }
  }, [defaultStateAbbr, selectedStateAbbr]);

  const selectedFeature = useMemo(
    () =>
      stateFeatures.find((feature) => feature.properties.abbr === selectedStateAbbr) ??
      stateFeatures[0] ??
      null,
    [selectedStateAbbr, stateFeatures],
  );

  return (
    <div className="min-h-svh w-full bg-background p-3 sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[94rem]">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Exploring the Trails and Nature of America&apos;s National Parks
        </h1>

        <div className="mt-1 grid grid-cols-1 items-start gap-4 lg:grid-cols-[0.95fr_1.45fr] lg:gap-6">
          <section className="flex flex-col p-1">
            <p className="pb-0.5 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {selectedFeature?.properties.name ?? "State"}
            </p>
            <div className="overflow-hidden rounded-xl aspect-[10/7]">
              <StateDetailSvg feature={selectedFeature} />
            </div>
          </section>

          <section className="flex flex-col p-1">
            <p className="pb-0.5 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              United States
            </p>
            <div className="overflow-hidden rounded-xl aspect-[10/7]">
              <UsOverviewSvg
                features={stateFeatures}
                selectedStateAbbr={selectedStateAbbr}
                onSelectState={setSelectedStateAbbr}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
