"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import usStatesData from "@/data/us-states.json";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
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

type ParkChartDatum = {
  parkCode: string;
  park: string;
  fullPark: string;
  trails: number;
};

type DifficultyKey = "easy" | "moderate" | "hard";

type DifficultyChartDatum = {
  difficulty: DifficultyKey;
  value: number;
};

const PARKS_CHART_CONFIG: ChartConfig = {
  trails: {
    label: "Trails",
    color: "var(--chart-2)",
  },
};

const DIFFICULTY_CHART_CONFIG: ChartConfig = {
  easy: {
    label: "Easy",
    color: "var(--chart-1)",
  },
  moderate: {
    label: "Moderate",
    color: "var(--chart-3)",
  },
  hard: {
    label: "Hard",
    color: "var(--chart-4)",
  },
};

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
}

function buildSelectedStateTrails(trails: Trail[], selectedStateAbbr: string): Trail[] {
  if (!selectedStateAbbr) return [];

  return trails.filter((trail) => {
    return splitStateCodes(trail.state).includes(selectedStateAbbr);
  });
}

function buildParkChartData(trails: Trail[]): ParkChartDatum[] {
  const byPark = new Map<string, { fullPark: string; trails: number }>();

  for (const trail of trails) {
    const current = byPark.get(trail.parkCode);
    if (current) {
      current.trails += 1;
    } else {
      byPark.set(trail.parkCode, {
        fullPark: trail.parkName,
        trails: 1,
      });
    }
  }

  return [...byPark.entries()]
    .map(([parkCode, value]) => ({
      parkCode,
      fullPark: value.fullPark,
      park: truncateLabel(value.fullPark, 20),
      trails: value.trails,
    }))
    .sort((a, b) => b.trails - a.trails || a.fullPark.localeCompare(b.fullPark))
    .slice(0, 10);
}

function buildDifficultyChartData(trails: Trail[]): DifficultyChartDatum[] {
  const counts: Record<DifficultyKey, number> = {
    easy: 0,
    moderate: 0,
    hard: 0,
  };

  for (const trail of trails) {
    if (trail.difficulty === "easy" || trail.difficulty === "moderate" || trail.difficulty === "hard") {
      counts[trail.difficulty] += 1;
    }
  }

  return [
    { difficulty: "easy", value: counts.easy },
    { difficulty: "moderate", value: counts.moderate },
    { difficulty: "hard", value: counts.hard },
  ];
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

  let path = "";
  if (feature) {
    const bounds = boundsFromGeometry(feature.geometry);
    if (bounds) {
      const project = makeProjector(bounds, 8);
      path = geometryToPath(feature.geometry, project);
    }
  }

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
          className="transition-[fill,stroke,opacity,filter] duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 10px color-mix(in srgb, var(--foreground) 28%, transparent))" }}
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
  const projected: Array<{ abbr: string; path: string; trailCount: number }> = [];
  const bounds = boundsFromCollection(features);

  if (bounds) {
    const project = makeProjector(bounds, 8, "top");

    for (const feature of features) {
      projected.push({
        abbr: feature.properties.abbr,
        trailCount: feature.properties.trailCount,
        path: geometryToPath(feature.geometry, project),
      });
    }
  }

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
            className="cursor-pointer transition-[fill,stroke,opacity,filter] duration-700 ease-out"
            style={{ filter: selected ? "drop-shadow(0 0 10px rgba(255,255,255,0.45))" : "none" }}
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
  const trailCounts = buildTrailCountByState(trails);
  const stateFeatures = buildStateFeatures(trailCounts);

  let defaultStateAbbr = "";
  if (stateFeatures.length > 0) {
    const ranked = [...stateFeatures].sort(
      (a, b) => b.properties.trailCount - a.properties.trailCount,
    );
    defaultStateAbbr = ranked[0]?.properties.abbr ?? stateFeatures[0].properties.abbr;
  }

  const autoCycleOrder = [...stateFeatures]
    .sort((a, b) => b.properties.trailCount - a.properties.trailCount)
    .map((feature) => feature.properties.abbr);
  const autoCycleOrderKey = autoCycleOrder.join(",");

  const [selectedStateAbbr, setSelectedStateAbbr] = useState(defaultStateAbbr);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState(5);
  const [isAnimateMode, setIsAnimateMode] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(0);

  useEffect(() => {
    const cycleOrder = autoCycleOrderKey ? autoCycleOrderKey.split(",") : [];

    if (!isAutoPlaying || cycleOrder.length <= 1 || isAnimateMode) {
      return;
    }

    let remainingSeconds = 5;

    const timer = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        setSelectedStateAbbr((current) => {
          const active = current || cycleOrder[0] || "";
          const index = cycleOrder.indexOf(active);

          if (index < 0) {
            return cycleOrder[0] || active;
          }

          return cycleOrder[(index + 1) % cycleOrder.length] || active;
        });

        remainingSeconds = 5;
      }

      setAutoCountdown(remainingSeconds);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAutoPlaying, autoCycleOrderKey, isAnimateMode]);

  useEffect(() => {
    const cycleOrder = autoCycleOrderKey ? autoCycleOrderKey.split(",") : [];

    if (!isAnimateMode || cycleOrder.length <= 1) {
      return;
    }

    const maxSteps = cycleOrder.length * 2;
    let step = 0;

    const timer = window.setInterval(() => {
      const nextAbbr = cycleOrder[step % cycleOrder.length] || cycleOrder[0] || "";
      setSelectedStateAbbr(nextAbbr);
      setAnimateProgress(step + 1);

      step += 1;
      if (step >= maxSteps) {
        window.clearInterval(timer);
        setIsAnimateMode(false);
      }
    }, 700);

    return () => window.clearInterval(timer);
  }, [isAnimateMode, autoCycleOrderKey]);

  const handleSelectState = (abbr: string) => {
    setSelectedStateAbbr(abbr);
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      setAutoCountdown(5);
    }
    if (isAnimateMode) {
      setIsAnimateMode(false);
      setAnimateProgress(0);
    }
  };

  const handleStartAnimateMode = () => {
    if (autoCycleOrder.length <= 1) return;

    setIsAutoPlaying(false);
    setAutoCountdown(5);
    setAnimateProgress(0);
    setIsAnimateMode(true);
  };

  const selectedFeature =
    stateFeatures.find((feature) => feature.properties.abbr === selectedStateAbbr) ??
    stateFeatures[0] ??
    null;

  const selectedStateCode = selectedFeature?.properties.abbr ?? "";
  const selectedStateTrails = buildSelectedStateTrails(trails, selectedStateCode);
  const parkChartData = buildParkChartData(selectedStateTrails);
  const difficultyChartData = buildDifficultyChartData(selectedStateTrails);

  const selectedParkCount = new Set(selectedStateTrails.map((trail) => trail.parkCode)).size;
  const selectedTrailCount = selectedStateTrails.length;
  const averageTrailsPerPark =
    selectedParkCount > 0
      ? Math.round((selectedTrailCount / selectedParkCount) * 10) / 10
      : 0;
  const stateTrailSharePercent =
    trails.length > 0
      ? Math.round((selectedTrailCount / trails.length) * 1000) / 10
      : 0;

  const difficultyHasValues = difficultyChartData.some((item) => item.value > 0);
  const topPark = parkChartData[0] ?? null;

  return (
    <div className="h-svh w-full overflow-y-auto bg-background p-3 sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[94rem]">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Exploring the Trails and Nature of America&apos;s National Parks
        </h1>

        <div className="mt-1 grid grid-cols-1 items-start gap-4 lg:grid-cols-[0.95fr_1.45fr] lg:gap-6">
          <section className="flex flex-col p-1">
            <p className="pb-0.5 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {selectedFeature?.properties.name ?? "State"}
            </p>
            <div className="relative overflow-hidden rounded-xl aspect-[10/7]">
              <StateDetailSvg feature={selectedFeature} />
            </div>
          </section>

          <section className="flex flex-col p-1">
            <div className="flex items-center justify-between pb-1">
              <p className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                United States
              </p>
              {!isAnimateMode ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant={isAutoPlaying ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsAutoPlaying((current) => !current);
                      setAutoCountdown(5);
                    }}
                    aria-label={isAutoPlaying ? "Pause automatic state playback" : "Start automatic state playback"}
                  >
                    {isAutoPlaying ? `Pause Auto (${autoCountdown}s)` : "Auto Play 5s"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStartAnimateMode}
                    aria-label="Start animate recording mode"
                  >
                    Animate
                  </Button>
                </div>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  Animating {animateProgress.toLocaleString()} / {(autoCycleOrder.length * 2).toLocaleString()}
                </p>
              )}
            </div>
            <div className="relative overflow-hidden rounded-xl aspect-[10/7]">
              <UsOverviewSvg
                features={stateFeatures}
                selectedStateAbbr={selectedStateAbbr}
                onSelectState={handleSelectState}
              />
            </div>
          </section>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.4fr_1fr]">
          <section className="p-2">
            <h2 className="text-base font-semibold text-card-foreground">State Snapshot</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Updates whenever you select a new state.
            </p>

            <dl className="mt-3 grid gap-3">
              <div className="flex items-end justify-between border-b border-border/60 pb-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trails</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{selectedTrailCount.toLocaleString()}</dd>
              </div>
              <div className="flex items-end justify-between border-b border-border/60 pb-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Parks</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{selectedParkCount.toLocaleString()}</dd>
              </div>
              <div className="flex items-end justify-between border-b border-border/60 pb-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trails / Park</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{averageTrailsPerPark.toLocaleString()}</dd>
              </div>
              <div className="flex items-end justify-between">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Share of US Trails</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{stateTrailSharePercent}%</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-muted-foreground">
              Top park: <span className="font-medium text-foreground">{topPark?.fullPark ?? "-"}</span>
            </p>
          </section>

          <section className="p-2">
            <h2 className="text-base font-semibold text-card-foreground">Top Parks by Trails</h2>
            <p className="mt-1 text-xs text-muted-foreground">Top 10 parks in {selectedFeature?.properties.name ?? "the selected state"}</p>

            {parkChartData.length > 0 ? (
              <ChartContainer config={PARKS_CHART_CONFIG} className="mt-3 h-[280px] w-full aspect-auto">
                <BarChart data={parkChartData} layout="vertical" margin={{ top: 6, right: 20, bottom: 6, left: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="park"
                    tickLine={false}
                    axisLine={false}
                    width={160}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as ParkChartDatum | undefined;
                          return item?.fullPark ?? "";
                        }}
                      />
                    }
                  />
                  <Bar dataKey="trails" fill="var(--color-trails)" radius={5} isAnimationActive={false}>
                    <LabelList dataKey="trails" position="right" fontSize={10} className="fill-muted-foreground" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="mt-3 flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                No park trail data available for this state.
              </div>
            )}
          </section>

          <section className="p-2">
            <h2 className="text-base font-semibold text-card-foreground">Difficulty Mix</h2>
            <p className="mt-1 text-xs text-muted-foreground">Easy vs moderate vs hard trails</p>

            {difficultyHasValues ? (
              <ChartContainer config={DIFFICULTY_CHART_CONFIG} className="mt-3 h-[280px] w-full aspect-auto">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="difficulty" labelKey="difficulty" />} />
                  <Pie
                    data={difficultyChartData}
                    dataKey="value"
                    nameKey="difficulty"
                    innerRadius={58}
                    outerRadius={96}
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {difficultyChartData.map((entry) => (
                      <Cell key={entry.difficulty} fill={`var(--color-${entry.difficulty})`} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="difficulty" className="flex-wrap gap-3" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="mt-3 flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                No difficulty data available for this state.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
