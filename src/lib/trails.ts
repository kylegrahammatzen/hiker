"use server";

import trailData from "@/data/trails.json";
import boundaryData from "@/data/boundaries.json";
import type { Trail } from "./types";

const MAX_BOUNDARY_DISTANCE_MILES = 2;
const MERGE_DISTANCE_MILES = 1.25;

type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type BoundaryFeature = GeoJSON.Feature<BoundaryGeometry, { parkCode?: string }>;

const ALL_TRAILS = trailData as Trail[];
const ALL_BOUNDARIES = boundaryData as unknown as GeoJSON.FeatureCollection<BoundaryGeometry>;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInRing(point: [number, number], ring: GeoJSON.Position[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;

    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: [number, number], polygon: GeoJSON.Position[][]): boolean {
  if (polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0] ?? [])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i] ?? [])) {
      return false;
    }
  }

  return true;
}

function pointInBoundary(point: [number, number], geometry: BoundaryGeometry): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

function distanceToSegmentMiles(point: [number, number], a: GeoJSON.Position, b: GeoJSON.Position): number {
  const px = point[0];
  const py = point[1];
  const ax = a[0] ?? 0;
  const ay = a[1] ?? 0;
  const bx = b[0] ?? 0;
  const by = b[1] ?? 0;

  const dx = bx - ax;
  const dy = by - ay;

  let t = 0;
  if (dx !== 0 || dy !== 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
  }

  const closestLng = ax + dx * t;
  const closestLat = ay + dy * t;
  return haversineMiles(py, px, closestLat, closestLng);
}

function minDistanceToBoundaryMiles(point: [number, number], geometry: BoundaryGeometry): number {
  let minDistance = Number.POSITIVE_INFINITY;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i += 1) {
        const distance = distanceToSegmentMiles(point, ring[i - 1] ?? [0, 0], ring[i] ?? [0, 0]);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }
  }

  return minDistance;
}

function buildBoundaryIndex(features: BoundaryFeature[]): Map<string, BoundaryGeometry> {
  const map = new Map<string, BoundaryGeometry>();

  for (const feature of features) {
    const parkCode = String(feature.properties?.parkCode ?? "").toLowerCase().trim();
    if (!parkCode) continue;
    map.set(parkCode, feature.geometry);
  }

  return map;
}

function trailDistanceMiles(a: Trail, b: Trail): number {
  return haversineMiles(
    a.coordinates.lat,
    a.coordinates.lng,
    b.coordinates.lat,
    b.coordinates.lng,
  );
}

function trailScore(trail: Trail): number {
  const descriptionScore = trail.description?.length ?? 0;
  const imageScore = (trail.images?.length ?? 0) * 50;
  const activityScore = (trail.activities?.length ?? 0) * 8;
  return descriptionScore + imageScore + activityScore;
}

function mergeTrailCluster(cluster: Trail[]): Trail {
  if (cluster.length === 1) return cluster[0]!;

  const representative = [...cluster]
    .sort((a, b) => {
      const scoreDelta = trailScore(b) - trailScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return a.id.localeCompare(b.id);
    })[0]!;

  const activities = [...new Set(cluster.flatMap((trail) => trail.activities ?? []))];
  const imageByUrl = new Map<string, NonNullable<Trail["images"]>[number]>();

  for (const trail of cluster) {
    for (const image of trail.images ?? []) {
      if (!imageByUrl.has(image.url)) {
        imageByUrl.set(image.url, image);
      }
    }
  }

  const mergedImages = [...imageByUrl.values()].slice(0, 8);
  const averageLat = cluster.reduce((sum, trail) => sum + trail.coordinates.lat, 0) / cluster.length;
  const averageLng = cluster.reduce((sum, trail) => sum + trail.coordinates.lng, 0) / cluster.length;

  return {
    ...representative,
    activities,
    images: mergedImages,
    imageUrl: mergedImages[0]?.url ?? representative.imageUrl,
    imageAlt: mergedImages[0]?.alt ?? representative.imageAlt,
    coordinates: {
      lat: averageLat,
      lng: averageLng,
    },
  };
}

function dedupeNearbyTrails(trails: Trail[], mergeDistanceMiles: number): Trail[] {
  const byPark = new Map<string, Trail[]>();

  for (const trail of trails) {
    const key = trail.parkCode.toLowerCase();
    const existing = byPark.get(key);
    if (existing) {
      existing.push(trail);
    } else {
      byPark.set(key, [trail]);
    }
  }

  const deduped: Trail[] = [];

  for (const parkTrails of byPark.values()) {
    const clusters: Trail[][] = [];

    for (const trail of parkTrails) {
      let matchedCluster: Trail[] | null = null;

      for (const cluster of clusters) {
        const representative = cluster[0]!;
        if (trailDistanceMiles(trail, representative) <= mergeDistanceMiles) {
          matchedCluster = cluster;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.push(trail);
      } else {
        clusters.push([trail]);
      }
    }

    for (const cluster of clusters) {
      deduped.push(mergeTrailCluster(cluster));
    }
  }

  deduped.sort((a, b) => {
    return (
      a.state.localeCompare(b.state) ||
      a.parkName.localeCompare(b.parkName) ||
      a.name.localeCompare(b.name)
    );
  });

  return deduped;
}

const BOUNDARY_BY_PARK = buildBoundaryIndex(ALL_BOUNDARIES.features as BoundaryFeature[]);

const FILTERED_TRAILS = ALL_TRAILS.filter((trail) => {
  const parkCode = trail.parkCode.toLowerCase();
  const geometry = BOUNDARY_BY_PARK.get(parkCode);
  if (!geometry) {
    return false;
  }

  const point: [number, number] = [trail.coordinates.lng, trail.coordinates.lat];
  if (pointInBoundary(point, geometry)) {
    return true;
  }

  const distanceMiles = minDistanceToBoundaryMiles(point, geometry);
  return distanceMiles <= MAX_BOUNDARY_DISTANCE_MILES;
});

const DEDUPED_TRAILS = dedupeNearbyTrails(FILTERED_TRAILS, MERGE_DISTANCE_MILES);

const FILTERED_TRAIL_PARK_CODES = new Set(DEDUPED_TRAILS.map((trail) => trail.parkCode.toLowerCase()));

const FILTERED_BOUNDARIES: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: ALL_BOUNDARIES.features.filter((feature) => {
    const parkCode = String((feature as BoundaryFeature).properties?.parkCode ?? "").toLowerCase();
    return FILTERED_TRAIL_PARK_CODES.has(parkCode);
  }),
};

export async function getTrails(): Promise<Trail[]> {
  return DEDUPED_TRAILS;
}

export async function getBoundaries(): Promise<GeoJSON.FeatureCollection> {
  return FILTERED_BOUNDARIES;
}

export async function getTrailById(id: string): Promise<Trail | undefined> {
  return DEDUPED_TRAILS.find((trail) => trail.id === id);
}

export async function getTrailsGeoJSON() {
  const trails = await getTrails();
  return {
    type: "FeatureCollection" as const,
    features: trails.map((trail) => ({
      type: "Feature" as const,
      properties: {
        id: trail.id,
        name: trail.name,
        parkName: trail.parkName,
        difficulty: trail.difficulty,
        length: trail.length,
        elevationGain: trail.elevationGain,
        imageUrl: trail.imageUrl,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [trail.coordinates.lng, trail.coordinates.lat],
      },
    })),
  };
}
