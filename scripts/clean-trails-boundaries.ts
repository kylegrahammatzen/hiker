import { join } from "path";
import type { Trail } from "../src/lib/types";

type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type BoundaryFeature = GeoJSON.Feature<BoundaryGeometry, { parkCode?: string }>;

function getArgValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function parsePositiveFloat(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_DISTANCE_MILES = parsePositiveFloat(getArgValue("max-distance"), 2);
const MERGE_DISTANCE_MILES = parsePositiveFloat(getArgValue("merge-distance"), 1.25);

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
    if (pointInRing(point, polygon[i] ?? [])) return false;
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
    const parkCode = trail.parkCode.toLowerCase();
    const items = byPark.get(parkCode);
    if (items) {
      items.push(trail);
    } else {
      byPark.set(parkCode, [trail]);
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

async function main() {
  const trailsPath = join(import.meta.dir, "..", "src", "data", "trails.json");
  const boundariesPath = join(import.meta.dir, "..", "src", "data", "boundaries.json");

  const trails = (await Bun.file(trailsPath).json()) as Trail[];
  const boundaries = (await Bun.file(boundariesPath).json()) as GeoJSON.FeatureCollection<BoundaryGeometry>;

  const boundaryByParkCode = buildBoundaryIndex(boundaries.features as BoundaryFeature[]);

  let removedNoBoundary = 0;
  let removedDistance = 0;

  const cleanedTrails = trails.filter((trail) => {
    const parkCode = trail.parkCode.toLowerCase();
    const geometry = boundaryByParkCode.get(parkCode);
    if (!geometry) {
      removedNoBoundary += 1;
      return false;
    }

    const point: [number, number] = [trail.coordinates.lng, trail.coordinates.lat];
    if (pointInBoundary(point, geometry)) return true;

    const distance = minDistanceToBoundaryMiles(point, geometry);
    if (distance > MAX_DISTANCE_MILES) {
      removedDistance += 1;
      return false;
    }

    return true;
  });

  const dedupedTrails = dedupeNearbyTrails(cleanedTrails, MERGE_DISTANCE_MILES);
  const removedByMerge = cleanedTrails.length - dedupedTrails.length;

  const parkCodes = new Set(dedupedTrails.map((trail) => trail.parkCode.toLowerCase()));
  const cleanedBoundaries: GeoJSON.FeatureCollection<BoundaryGeometry> = {
    type: "FeatureCollection",
    features: boundaries.features.filter((feature) => {
      const parkCode = String((feature as BoundaryFeature).properties?.parkCode ?? "").toLowerCase();
      return parkCodes.has(parkCode);
    }),
  };

  await Bun.write(trailsPath, JSON.stringify(dedupedTrails, null, 2));
  await Bun.write(boundariesPath, JSON.stringify(cleanedBoundaries));

  console.log(`Cleaned trails with max distance ${MAX_DISTANCE_MILES} miles`);
  console.log(`Merged nearby trails within ${MERGE_DISTANCE_MILES} miles`);
  console.log(`Removed ${removedNoBoundary} trails with no matching boundary`);
  console.log(`Removed ${removedDistance} trails too far from park boundary`);
  console.log(`Merged ${removedByMerge} nearby trail points`);
  console.log(`Remaining trails: ${dedupedTrails.length}`);
  console.log(`Remaining boundaries: ${cleanedBoundaries.features.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
