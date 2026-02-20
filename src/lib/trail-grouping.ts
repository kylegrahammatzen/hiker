import type { Trail } from "./types";

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

export function computeDisplayGroups(groups: ParkGroup[]): DisplayGroups {
  // Sort by trail count descending
  const sorted = [...groups].sort((a, b) => b.trails.length - a.trails.length);

  return {
    multiGroups: sorted,
    singlesGroup: null,
    onlySingles: false,
    allGroups: sorted,
    uniqueParkCount: groups.length,
  };
}
