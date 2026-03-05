import type { Trail } from "./types";

export type GroupMode = "park" | "state";

export type ParkGroup = {
  parkName: string;
  parkCode: string;
  trails: Trail[];
};

const DIFFICULTY_ORDER = { easy: 0, moderate: 1, hard: 2 } as const;

export function sortTrails(trails: Trail[]): Trail[] {
  return [...trails].sort((a, b) => {
    const diff = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (diff !== 0) return diff;
    return (parseFloat(a.length) || 0) - (parseFloat(b.length) || 0);
  });
}

export function groupByPark(trails: Trail[]): ParkGroup[] {
  const map = new Map<string, { parkCode: string; trails: Trail[] }>();
  for (const t of trails) {
    const existing = map.get(t.parkName);
    if (existing) existing.trails.push(t);
    else map.set(t.parkName, { parkCode: t.parkCode, trails: [t] });
  }
  return Array.from(map, ([parkName, { parkCode, trails }]) => ({
    parkName,
    parkCode,
    trails,
  }));
}

export type DisplayGroups = {
  /** Groups with multiple trails, sorted by trail count descending */
  multiGroups: ParkGroup[];
  /** Synthetic group containing all single-trail parks, or null if none */
  singlesGroup: ParkGroup | null;
  /** True if all parks have only 1 trail (no "Other Parks" needed) */
  onlySingles: boolean;
  /** All groups to render in order */
  allGroups: ParkGroup[];
  /** Total number of unique parks (for accurate counting) */
  uniqueParkCount: number;
};

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

function expandStateName(abbr: string): string {
  if (abbr.includes(",")) {
    return abbr
      .split(",")
      .map((s) => STATE_NAMES[s.trim()] ?? s.trim())
      .join(", ");
  }
  return STATE_NAMES[abbr] ?? abbr;
}

export function groupByState(trails: Trail[]): ParkGroup[] {
  const map = new Map<string, Trail[]>();
  for (const t of trails) {
    const state = t.state || "Unknown";
    const arr = map.get(state);
    if (arr) arr.push(t);
    else map.set(state, [t]);
  }
  return Array.from(map, ([state, stateTrails]) => ({
    parkName: expandStateName(state),
    parkCode: state.toLowerCase().replace(/[^a-z]/g, ""),
    trails: stateTrails,
  }));
}

export function groupTrails(trails: Trail[], mode: GroupMode): ParkGroup[] {
  return mode === "state" ? groupByState(trails) : groupByPark(trails);
}

export function computeDisplayGroups(groups: ParkGroup[]): DisplayGroups {
  const sorted = [...groups].sort((a, b) => b.trails.length - a.trails.length);

  return {
    multiGroups: sorted,
    singlesGroup: null,
    onlySingles: false,
    allGroups: sorted,
    uniqueParkCount: groups.length,
  };
}
