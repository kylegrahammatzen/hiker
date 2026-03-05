import { join } from "path";

const FEATURE_SERVER =
  "https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer";

const BOUNDARY_LAYER = `${FEATURE_SERVER}/2/query`;

type ArcGISFeature = {
  type: "Feature";
  properties: Record<string, string>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type ArcGISGeoJSON = {
  type: "FeatureCollection";
  features: ArcGISFeature[];
};

// Reduce coordinate precision (5 decimals = ~1m accuracy)
function roundCoord(coords: number[]): number[] {
  return coords.map((c) => Math.round(c * 100_000) / 100_000);
}

// Douglas-Peucker line simplification
function distToSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  if (dx === 0 && dy === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!);
  const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
}

function douglasPeucker(points: number[][], epsilon: number): number[][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i]!, points[0]!, points[points.length - 1]!);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0]!, points[points.length - 1]!];
}

// ~0.001 degrees is roughly 100m tolerance
const SIMPLIFY_TOLERANCE = 0.001;

function simplifyRing(ring: number[][]): number[][] {
  const simplified = douglasPeucker(ring, SIMPLIFY_TOLERANCE);
  return simplified.map(roundCoord);
}

function simplifyGeometry(
  geometry: ArcGISFeature["geometry"]
): ArcGISFeature["geometry"] {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: (geometry.coordinates as number[][][]).map(simplifyRing),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: (geometry.coordinates as number[][][][]).map((polygon) =>
      polygon.map(simplifyRing)
    ),
  };
}

// NPS API codes that differ from the boundary dataset codes
const CODE_MAP: Record<string, string> = {
  isle: "ISRO",
  seki: "SEQU",
  wite: "WHSA",
  jeff: "JEFF",
};

const REVERSE_CODE_MAP = Object.fromEntries(
  Object.entries(CODE_MAP).map(([api, boundary]) => [boundary.toLowerCase(), api])
);

function toBoundaryCode(apiCode: string): string {
  return (CODE_MAP[apiCode] ?? apiCode).toUpperCase();
}

function toApiCode(boundaryCode: string): string {
  const lower = boundaryCode.toLowerCase();
  return REVERSE_CODE_MAP[lower] ?? lower;
}

async function fetchBoundaries(parkCodes: string[]): Promise<ArcGISGeoJSON> {
  const where = parkCodes
    .map((code) => `UNIT_CODE='${toBoundaryCode(code)}'`)
    .join(" OR ");

  const params = new URLSearchParams({
    where,
    outFields: "UNIT_CODE,UNIT_NAME,UNIT_TYPE,STATE",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });

  const url = `${BOUNDARY_LAYER}?${params}`;
  console.log(`Fetching boundaries for ${parkCodes.length} parks...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return (await res.json()) as ArcGISGeoJSON;
}

async function main() {
  // Import the park codes from the trails script dynamically
  const trailsScript = await Bun.file(
    join(import.meta.dir, "fetch-nps-trails.ts")
  ).text();
  const match = trailsScript.match(
    /const HIKING_PARKS\s*=\s*\[([\s\S]*?)\]\s*as\s*const/
  );
  if (!match) throw new Error("Could not parse HIKING_PARKS from trails script");

  const parkCodes = [...match[1]!.matchAll(/"([a-z]+)"/g)].map((m) => m[1]!);
  console.log(`Found ${parkCodes.length} park codes`);

  // Fetch in batches (ArcGIS URL length limits)
  const batchSize = 20;
  const allFeatures: ArcGISFeature[] = [];

  for (let i = 0; i < parkCodes.length; i += batchSize) {
    const batch = parkCodes.slice(i, i + batchSize);
    const geojson = await fetchBoundaries(batch);

    for (const feature of geojson.features) {
      const boundaryCode = feature.properties.UNIT_CODE ?? "";
      const parkCode = toApiCode(boundaryCode);
      allFeatures.push({
        type: "Feature",
        properties: {
          parkCode,
          name: feature.properties.UNIT_NAME ?? "",
          type: feature.properties.UNIT_TYPE ?? "",
          state: feature.properties.STATE ?? "",
        },
        geometry: simplifyGeometry(feature.geometry),
      });
    }

    const found = geojson.features.length;
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: requested ${batch.length}, got ${found} boundaries`);
    await Bun.sleep(500);
  }

  const missing = parkCodes.filter(
    (code) => !allFeatures.some((f) => f.properties.parkCode === code)
  );
  if (missing.length > 0) {
    console.log(`\nNo boundaries found for: ${missing.join(", ")}`);
  }

  const output = {
    type: "FeatureCollection" as const,
    features: allFeatures,
  };

  const outputPath = join(import.meta.dir, "..", "src", "data", "boundaries.json");
  const raw = JSON.stringify(output);
  const sizeMB = (raw.length / 1_000_000).toFixed(2);

  await Bun.write(outputPath, raw);
  console.log(`\nWrote ${allFeatures.length} boundaries (${sizeMB} MB) to ${outputPath}`);
}

main().catch(console.error);
