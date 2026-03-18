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

const LISTABLE_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

function parseTrailStateCodes(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((code) => code.length === 2 && LISTABLE_STATE_CODES.has(code));
}

export function groupByState(trails: Trail[]): ParkGroup[] {
  const map = new Map<string, Trail[]>();

  for (const t of trails) {
    const states = parseTrailStateCodes(t.state || "");
    for (const stateCode of states) {
      const arr = map.get(stateCode);
      if (arr) arr.push(t);
      else map.set(stateCode, [t]);
    }
  }

  return Array.from(map, ([stateCode, stateTrails]) => ({
    parkName: STATE_NAMES[stateCode] ?? stateCode,
    parkCode: stateCode.toLowerCase(),
    trails: stateTrails,
  }));
}

export function groupTrails(trails: Trail[], mode: GroupMode): ParkGroup[] {
  return mode === "state" ? groupByState(trails) : groupByPark(trails);
}

export function computeDisplayGroups(groups: ParkGroup[]): DisplayGroups {
  const sorted = [...groups].sort((a, b) =>
    a.parkName.localeCompare(b.parkName, undefined, { sensitivity: "base" }),
  );

  return {
    multiGroups: sorted,
    singlesGroup: null,
    onlySingles: false,
    allGroups: sorted,
    uniqueParkCount: groups.length,
  };
}
