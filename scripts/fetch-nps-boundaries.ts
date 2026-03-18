import { join } from "path";

function getArgValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveFloat(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BATCH_SIZE = parsePositiveInt(getArgValue("batch-size"), 20);
const SIMPLIFY_TOLERANCE = parsePositiveFloat(getArgValue("tolerance"), 0.001);

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

function samePoint(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
}

function ensureClosedRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (samePoint(first, last)) return ring;
  return [...ring, [first[0]!, first[1]!]];
}

function simplifyRing(ring: number[][]): number[][] | null {
  if (ring.length < 4) return null;

  const closed = ensureClosedRing(ring);
  const simplified = douglasPeucker(closed, SIMPLIFY_TOLERANCE);
  const reclosed = ensureClosedRing(simplified).map(roundCoord);

   if (reclosed.length >= 4) return reclosed;

  const fallback = ensureClosedRing(ring).map(roundCoord);
  return fallback.length >= 4 ? fallback : null;
}

function simplifyGeometry(
  geometry: ArcGISFeature["geometry"]
): ArcGISFeature["geometry"] | null {
  if (geometry.type === "Polygon") {
    const rings = (geometry.coordinates as number[][][])
      .map(simplifyRing)
      .filter((ring): ring is number[][] => ring !== null);

    if (rings.length === 0) return null;

    return {
      type: "Polygon",
      coordinates: rings,
    };
  }

  const polygons = (geometry.coordinates as number[][][][])
    .map((polygon) =>
      polygon
        .map(simplifyRing)
        .filter((ring): ring is number[][] => ring !== null),
    )
    .filter((polygon) => polygon.length > 0);

  if (polygons.length === 0) return null;

  return {
    type: "MultiPolygon",
    coordinates: polygons,
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

async function getParkCodesFromTrails(): Promise<string[]> {
  const trailsPath = join(import.meta.dir, "..", "src", "data", "trails.json");

  if (!(await Bun.file(trailsPath).exists())) {
    throw new Error(`Missing trails data at ${trailsPath}. Run bun run fetch first.`);
  }

  const trails = (await Bun.file(trailsPath).json()) as Array<{ parkCode?: string }>;
  const parkCodes = [...new Set(trails.map((trail) => trail.parkCode?.toLowerCase() ?? "").filter(Boolean))];

  if (parkCodes.length === 0) {
    throw new Error(`No park codes found in ${trailsPath}`);
  }

  return parkCodes.sort();
}

async function main() {
  const parkCodes = await getParkCodesFromTrails();
  console.log(`Found ${parkCodes.length} park codes`);

  // Fetch in batches (ArcGIS URL length limits)
  const allFeatures: ArcGISFeature[] = [];

  for (let i = 0; i < parkCodes.length; i += BATCH_SIZE) {
    const batch = parkCodes.slice(i, i + BATCH_SIZE);
    const geojson = await fetchBoundaries(batch);

    for (const feature of geojson.features) {
      const boundaryCode = feature.properties.UNIT_CODE ?? "";
      const parkCode = toApiCode(boundaryCode);
      const simplifiedGeometry = simplifyGeometry(feature.geometry);
      if (!simplifiedGeometry) continue;

      allFeatures.push({
        type: "Feature",
        properties: {
          parkCode,
          name: feature.properties.UNIT_NAME ?? "",
          type: feature.properties.UNIT_TYPE ?? "",
          state: feature.properties.STATE ?? "",
        },
        geometry: simplifiedGeometry,
      });
    }

    const found = geojson.features.length;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: requested ${batch.length}, got ${found} boundaries`);
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
