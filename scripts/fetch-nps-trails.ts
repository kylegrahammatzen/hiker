import { join } from "path";
import { existsSync } from "fs";
import type { Trail, TrailImage } from "../src/lib/types";

const QUICK_CHECK = process.argv.includes("--quick");

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

function parseStateFilter(value: string | null): Set<string> {
  if (!value) return new Set<string>();

  return new Set(
    value
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter((part) => /^[A-Z]{2}$/.test(part)),
  );
}

const PARK_LIMIT = parsePositiveInt(getArgValue("park-limit"), 0);
const MAX_TRAILS_PER_PARK = parsePositiveInt(getArgValue("max-trails-per-park"), 40);
const STATE_FILTER = parseStateFilter(getArgValue("states"));

const NPS_API_KEY = process.env.NPS_API_KEY ?? "DEMO_KEY";
const NPS_BASE = "https://developer.nps.gov/api/v1";

const ALL_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
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
] as const;

type NPSImage = {
  url: string;
  altText: string;
  caption: string;
};

type NPSActivity = {
  name: string;
};

type NPSPark = {
  parkCode: string;
  fullName: string;
  description: string;
  latitude: string;
  longitude: string;
  states: string;
  designation: string;
  images: NPSImage[];
  activities: NPSActivity[];
};

type NPSThingToDo = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  latitude: string;
  longitude: string;
  images: NPSImage[];
  activities: NPSActivity[];
  duration: string;
  relatedParks: { parkCode: string; fullName: string; states: string }[];
};

type NPSResponse<T> = {
  total: string;
  limit: string;
  start: string;
  data: T[];
};

const HIKING_ACTIVITY_KEYWORDS = [
  "hiking",
  "hike",
  "backpack",
  "walking",
  "walk",
  "trail",
  "trek",
];

const HIKING_TEXT_KEYWORDS = [
  "hiking",
  "hike",
  "trail",
  "walk",
  "trek",
  "backpack",
  "path",
  "footpath",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function normalizeStates(raw: string): string {
  const parts = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[A-Z]{2}$/.test(value));

  return [...new Set(parts)].join(",");
}

function parseStateCodes(raw: string): string[] {
  return normalizeStates(raw)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function activityLooksLikeHiking(activityName: string): boolean {
  const text = activityName.toLowerCase();
  return HIKING_ACTIVITY_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasHikingActivity(activities: NPSActivity[] = []): boolean {
  return activities.some((activity) => activityLooksLikeHiking(activity.name));
}

function textLooksLikeTrail(...pieces: Array<string | undefined>): boolean {
  const text = pieces.filter(Boolean).join(" ").toLowerCase();
  return HIKING_TEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function parseCoord(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateDifficulty(description: string, duration: string): Trail["difficulty"] {
  const text = `${description} ${duration}`.toLowerCase();
  if (
    text.includes("strenuous") ||
    text.includes("difficult") ||
    text.includes("challenging") ||
    text.includes("steep") ||
    text.includes("all day") ||
    text.includes("expert")
  ) {
    return "hard";
  }
  if (
    text.includes("moderate") ||
    text.includes("3-6") ||
    text.includes("half day") ||
    text.includes("intermediate")
  ) {
    return "moderate";
  }
  return "easy";
}

function estimateLength(description: string, duration: string): string {
  const mileMatch = description.match(/(\d+\.?\d*)\s*(?:mile|mi)\b/i);
  if (mileMatch) return `${mileMatch[1]} mi`;

  const kmMatch = description.match(/(\d+\.?\d*)\s*(?:kilometer|km)\b/i);
  if (kmMatch) return `${(Number.parseFloat(kmMatch[1]!) * 0.621371).toFixed(1)} mi`;

  if (duration.includes("1-3")) return "1-3 mi";
  if (duration.includes("3-6")) return "3-6 mi";
  if (duration.match(/\b6\+?|7\+?|8\+?\b/)) return "6+ mi";
  return "Varies";
}

function estimateElevation(description: string): string {
  const elevMatch = description.match(
    /(\d[\d,]*)\s*(?:feet|ft|foot)\s*(?:of\s+)?(?:elevation|gain)/i,
  );
  if (elevMatch) return `${elevMatch[1]} ft`;

  const text = description.toLowerCase();
  if (text.includes("steep") || text.includes("strenuous")) return "1,500+ ft";
  if (text.includes("moderate")) return "500-1,500 ft";
  return "Minimal";
}

async function validateImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function collectImages(
  hikeImages: NPSImage[] = [],
  parkImages: NPSImage[] = [],
  fallbackAlt: string,
): { images: TrailImage[]; imageUrl: string; imageAlt: string } {
  const seen = new Set<string>();
  const images: TrailImage[] = [];

  for (const image of [...hikeImages, ...parkImages]) {
    if (!image.url || seen.has(image.url)) continue;
    if (!/^https?:\/\//i.test(image.url)) continue;

    seen.add(image.url);
    images.push({
      url: image.url,
      alt: image.altText || fallbackAlt,
      caption: image.caption || "",
    });

    if (images.length >= 5) break;
  }

  return {
    images,
    imageUrl: images[0]?.url ?? "/images/trails/default.jpg",
    imageAlt: images[0]?.alt ?? fallbackAlt,
  };
}

function summarizeStateCoverage(trails: Trail[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const trail of trails) {
    for (const code of parseStateCodes(trail.state)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return counts;
}

async function fetchWithRetry<T>(url: string, retries = 4): Promise<T | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(url);

      if (res.status === 429) {
        const waitMs = (attempt + 1) * 2000;
        console.log(`  Rate limited, waiting ${waitMs / 1000}s...`);
        await Bun.sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const waitMs = (attempt + 1) * 1000;
        console.log(`  HTTP ${res.status}, retrying in ${waitMs / 1000}s...`);
        await Bun.sleep(waitMs);
        continue;
      }

      return (await res.json()) as T;
    } catch {
      const waitMs = (attempt + 1) * 1000;
      console.log(`  Fetch error, retrying in ${waitMs / 1000}s...`);
      await Bun.sleep(waitMs);
    }
  }

  return null;
}

async function fetchAllParks(): Promise<NPSPark[]> {
  const parks: NPSPark[] = [];
  const limit = 100;
  let start = 0;

  while (true) {
    const url = `${NPS_BASE}/parks?limit=${limit}&start=${start}&api_key=${NPS_API_KEY}`;
    const json = await fetchWithRetry<NPSResponse<NPSPark>>(url);
    if (!json?.data?.length) break;

    parks.push(...json.data);

    const total = Number.parseInt(json.total ?? "0", 10);
    start += json.data.length;

    console.log(`  Parks fetched: ${parks.length}${total ? ` / ${total}` : ""}`);

    if (total && start >= total) break;
    if (json.data.length < limit) break;

    await Bun.sleep(150);
  }

  return parks;
}

async function fetchThingsToDo(parkCode: string): Promise<NPSThingToDo[]> {
  const allThings: NPSThingToDo[] = [];
  const limit = 50;
  let start = 0;

  while (true) {
    const url =
      `${NPS_BASE}/thingstodo?parkCode=${parkCode}&limit=${limit}&start=${start}&api_key=${NPS_API_KEY}`;
    const json = await fetchWithRetry<NPSResponse<NPSThingToDo>>(url);
    if (!json?.data?.length) break;

    allThings.push(...json.data);

    if (json.data.length < limit) break;
    start += json.data.length;
    await Bun.sleep(120);
  }

  return allThings;
}

function parkMatchesStateFilter(park: NPSPark): boolean {
  if (STATE_FILTER.size === 0) return true;

  const parkStates = parseStateCodes(park.states);
  return parkStates.some((code) => STATE_FILTER.has(code));
}

function isLikelyHikeThing(thing: NPSThingToDo): boolean {
  if (hasHikingActivity(thing.activities)) return true;

  return textLooksLikeTrail(
    thing.title,
    thing.shortDescription,
    thing.longDescription,
    thing.duration,
  );
}

function pickTrailStates(hike: NPSThingToDo, park: NPSPark): string {
  const fromRelated = (hike.relatedParks ?? []).find(
    (entry) => entry.parkCode?.toLowerCase() === park.parkCode.toLowerCase(),
  );

  if (fromRelated?.states) {
    const normalized = normalizeStates(fromRelated.states);
    if (normalized) return normalized;
  }

  const normalizedParkStates = normalizeStates(park.states);
  if (normalizedParkStates) return normalizedParkStates;

  const mergedRelatedStates = [...new Set((hike.relatedParks ?? []).flatMap((entry) => parseStateCodes(entry.states)))];
  return mergedRelatedStates.join(",");
}

function buildTrailFromHike(hike: NPSThingToDo, park: NPSPark): Trail | null {
  const lat = parseCoord(hike.latitude) ?? parseCoord(park.latitude);
  const lng = parseCoord(hike.longitude) ?? parseCoord(park.longitude);
  if (lat === null || lng === null) return null;

  const state = pickTrailStates(hike, park);

  const descriptionSource = hike.shortDescription || hike.longDescription || park.description || hike.title;
  const description = descriptionSource.trim().replace(/\s+/g, " ").slice(0, 220);

  const { images, imageUrl, imageAlt } = collectImages(
    hike.images ?? [],
    park.images ?? [],
    hike.title,
  );

  const activities = [...new Set((hike.activities ?? []).map((activity) => activity.name).filter(Boolean))];

  return {
    id: `${park.parkCode}-${hike.id || slugify(hike.title)}`,
    name: hike.title,
    parkName: park.fullName,
    parkCode: park.parkCode,
    location: `${park.fullName}${state ? `, ${state}` : ""}`,
    state,
    description,
    difficulty: estimateDifficulty(`${hike.title} ${description}`, hike.duration ?? ""),
    length: estimateLength(`${description} ${hike.longDescription ?? ""}`, hike.duration ?? ""),
    elevationGain: estimateElevation(`${description} ${hike.longDescription ?? ""}`),
    imageUrl,
    imageAlt,
    images,
    coordinates: { lat, lng },
    activities,
  };
}

function buildTrailFromPark(park: NPSPark): Trail | null {
  const lat = parseCoord(park.latitude);
  const lng = parseCoord(park.longitude);
  if (lat === null || lng === null) return null;

  const state = normalizeStates(park.states);

  const description = (park.description || park.fullName)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 220);

  const { images, imageUrl, imageAlt } = collectImages([], park.images ?? [], park.fullName);

  return {
    id: `${park.parkCode}-park-hiking`,
    name: `Hiking at ${park.fullName}`,
    parkName: park.fullName,
    parkCode: park.parkCode,
    location: `${park.fullName}${state ? `, ${state}` : ""}`,
    state,
    description,
    difficulty: "moderate",
    length: "Varies",
    elevationGain: "Varies",
    imageUrl,
    imageAlt,
    images,
    coordinates: { lat, lng },
    activities: [...new Set((park.activities ?? []).map((activity) => activity.name).filter(Boolean))],
  };
}

async function runQuickImageValidation(outputPath: string): Promise<void> {
  if (!existsSync(outputPath)) {
    console.log("Quick check mode requested, but trails.json does not exist yet.");
    return;
  }

  console.log("Quick check mode: validating existing images...");
  const content = (await Bun.file(outputPath).json()) as Trail[];
  let removed = 0;

  for (const trail of content) {
    const validImages: TrailImage[] = [];

    for (const image of trail.images ?? []) {
      const valid = await validateImageUrl(image.url);
      if (valid) {
        validImages.push(image);
      } else {
        removed += 1;
      }
    }

    trail.images = validImages;
    trail.imageUrl = validImages[0]?.url ?? "/images/trails/default.jpg";
    trail.imageAlt = validImages[0]?.alt ?? trail.name;
  }

  await Bun.write(outputPath, JSON.stringify(content, null, 2));
  console.log(`Removed ${removed} invalid images`);
  console.log(`Written to ${outputPath}`);
}

async function main() {
  const outputPath = join(import.meta.dir, "..", "src", "data", "trails.json");

  if (QUICK_CHECK) {
    await runQuickImageValidation(outputPath);
    return;
  }

  if (NPS_API_KEY === "DEMO_KEY") {
    console.log("Warning: using DEMO_KEY. Add NPS_API_KEY in .env for full results.");
  }

  if (STATE_FILTER.size > 0) {
    console.log(`State filter: ${[...STATE_FILTER].join(",")}`);
  }

  console.log("Fetching parks catalog from NPS API...");
  const allParks = await fetchAllParks();
  console.log(`Fetched ${allParks.length} parks`);

  const eligibleParks = allParks
    .filter((park) => park.parkCode && park.fullName)
    .filter((park) => parseStateCodes(park.states).length > 0)
    .filter(parkMatchesStateFilter)
    .sort((a, b) => a.parkCode.localeCompare(b.parkCode));

  const parksToProcess = PARK_LIMIT > 0 ? eligibleParks.slice(0, PARK_LIMIT) : eligibleParks;

  console.log(`Processing ${parksToProcess.length} parks for trails...`);

  const seen = new Set<string>();
  const trails: Trail[] = [];

  for (let index = 0; index < parksToProcess.length; index += 1) {
    const park = parksToProcess[index]!;
    const before = trails.length;

    const things = await fetchThingsToDo(park.parkCode);
    const hikingThings = things.filter(isLikelyHikeThing);

    for (const hike of hikingThings.slice(0, MAX_TRAILS_PER_PARK)) {
      const trail = buildTrailFromHike(hike, park);
      if (!trail || !trail.state) continue;

      if (!seen.has(trail.id)) {
        seen.add(trail.id);
        trails.push(trail);
      }
    }

    if (hikingThings.length === 0 && hasHikingActivity(park.activities)) {
      const fallback = buildTrailFromPark(park);
      if (fallback && fallback.state && !seen.has(fallback.id)) {
        seen.add(fallback.id);
        trails.push(fallback);
      }
    }

    const added = trails.length - before;
    console.log(
      `[${index + 1}/${parksToProcess.length}] ${park.parkCode} ${park.fullName} - ` +
        `${things.length} activities, ${hikingThings.length} hiking, ${added} trails added`,
    );

    await Bun.sleep(150);
  }

  trails.sort((a, b) => {
    return (
      a.state.localeCompare(b.state) ||
      a.parkName.localeCompare(b.parkName) ||
      a.name.localeCompare(b.name)
    );
  });

  const stateCounts = summarizeStateCoverage(trails);
  const coveredStates = [...stateCounts.keys()].sort();
  const missingStates = ALL_STATE_CODES.filter((code) => !stateCounts.has(code));

  console.log(`\nTotal trails: ${trails.length}`);
  console.log(`Parks with trails: ${new Set(trails.map((trail) => trail.parkCode)).size}`);
  console.log(`States covered: ${coveredStates.length}`);
  console.log(`Covered states: ${coveredStates.join(",")}`);
  if (missingStates.length > 0) {
    console.log(`Missing states: ${missingStates.join(",")}`);
  }

  await Bun.write(outputPath, JSON.stringify(trails, null, 2));
  console.log(`Written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
