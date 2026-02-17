import { join } from "path";
import type { Trail, TrailImage } from "../src/lib/types";

const NPS_API_KEY = process.env.NPS_API_KEY ?? "DEMO_KEY";
const NPS_BASE = "https://developer.nps.gov/api/v1";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

const HIKING_PARKS = [
  // Original 30
  "yose", "grca", "zion", "romo", "grsm", "glac", "shen", "acad",
  "olym", "mora", "seki", "brca", "arch", "cany", "grte", "dena",
  "jotr", "havo", "neri", "badl", "grsa", "meve", "blca", "crla",
  "redw", "pinn", "indu", "cuva", "viis", "bibe",
  // Additional parks
  "yell", "ever", "bisc", "care", "cave", "chis", "cong", "deva",
  "drto", "gaar", "jeff", "katm", "kefj", "kova", "lacl", "lavo",
  "maca", "noca", "pefo", "sagu", "thro", "wica", "wrst", "band",
  "gumo", "grba", "hosp", "isle", "voya", "cuga",
] as const;

function estimateDifficulty(
  description: string,
  duration: string
): Trail["difficulty"] {
  const text = `${description} ${duration}`.toLowerCase();
  if (
    text.includes("strenuous") ||
    text.includes("difficult") ||
    text.includes("challenging") ||
    text.includes("steep") ||
    text.includes("all day")
  ) {
    return "hard";
  }
  if (
    text.includes("moderate") ||
    text.includes("3-6") ||
    text.includes("half day")
  ) {
    return "moderate";
  }
  return "easy";
}

function estimateLength(description: string, duration: string): string {
  const mileMatch = description.match(/(\d+\.?\d*)\s*(?:mile|mi)/i);
  if (mileMatch) return `${mileMatch[1]} mi`;

  const kmMatch = description.match(/(\d+\.?\d*)\s*(?:kilometer|km)/i);
  if (kmMatch) return `${(parseFloat(kmMatch[1]!) * 0.621371).toFixed(1)} mi`;

  if (duration.includes("1-3")) return "1-3 mi";
  if (duration.includes("3-6")) return "3-6 mi";
  if (duration.includes("6")) return "6+ mi";
  return "Varies";
}

function estimateElevation(description: string): string {
  const elevMatch = description.match(
    /(\d[\d,]*)\s*(?:feet|ft|foot)\s*(?:of\s+)?(?:elevation|gain)/i
  );
  if (elevMatch) return `${elevMatch[1]} ft`;

  const desc = description.toLowerCase();
  if (desc.includes("steep") || desc.includes("strenuous")) return "1,500+ ft";
  if (desc.includes("moderate")) return "500-1,500 ft";
  return "Minimal";
}

async function fetchWithRetry<T>(url: string, retries = 3): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        console.log(`  Rate limited, waiting ${(i + 1) * 2}s...`);
        await Bun.sleep((i + 1) * 2000);
        continue;
      }
      if (!res.ok) {
        console.log(`  HTTP ${res.status}, retrying...`);
        await Bun.sleep(1000);
        continue;
      }
      return (await res.json()) as T;
    } catch {
      console.log(`  Fetch error, retrying in ${i + 1}s...`);
      await Bun.sleep((i + 1) * 1000);
    }
  }
  return null;
}

async function fetchParks(): Promise<NPSPark[]> {
  const allParks: NPSPark[] = [];
  const chunkSize = 5;

  for (let i = 0; i < HIKING_PARKS.length; i += chunkSize) {
    const chunk = HIKING_PARKS.slice(i, i + chunkSize);
    const codes = chunk.join(",");
    const url = `${NPS_BASE}/parks?parkCode=${codes}&limit=10&api_key=${NPS_API_KEY}`;
    console.log(`  Fetching parks batch ${Math.floor(i / chunkSize) + 1}...`);
    const json = await fetchWithRetry<NPSResponse<NPSPark>>(url);
    if (json?.data) allParks.push(...json.data);
    await Bun.sleep(1000);
  }

  return allParks;
}

async function fetchThingsToDo(parkCode: string): Promise<NPSThingToDo[]> {
  const url = `${NPS_BASE}/thingstodo?parkCode=${parkCode}&limit=50&api_key=${NPS_API_KEY}`;
  const json = await fetchWithRetry<NPSResponse<NPSThingToDo>>(url);
  return json?.data ?? [];
}

function isHikingActivity(activity: NPSActivity): boolean {
  return (
    activity.name === "Hiking" ||
    activity.name === "Front-Country Hiking" ||
    activity.name === "Backpacking"
  );
}

function collectImages(
  hikeImages: NPSImage[],
  parkImages: NPSImage[],
  fallbackAlt: string
): { images: TrailImage[]; imageUrl: string; imageAlt: string } {
  const seen = new Set<string>();
  const images: TrailImage[] = [];

  for (const img of [...hikeImages, ...parkImages]) {
    if (!img.url || seen.has(img.url)) continue;
    seen.add(img.url);
    images.push({ url: img.url, alt: img.altText || fallbackAlt, caption: img.caption || "" });
    if (images.length >= 5) break;
  }

  return {
    images,
    imageUrl: images[0]?.url ?? "/images/trails/default.jpg",
    imageAlt: images[0]?.alt ?? fallbackAlt,
  };
}

function buildTrailFromHike(
  hike: NPSThingToDo,
  park: NPSPark
): Trail | null {
  const lat = hike.latitude
    ? parseFloat(hike.latitude)
    : parseFloat(park.latitude);
  const lng = hike.longitude
    ? parseFloat(hike.longitude)
    : parseFloat(park.longitude);

  if (isNaN(lat) || isNaN(lng)) return null;

  const { images, imageUrl, imageAlt } = collectImages(
    hike.images ?? [],
    park.images ?? [],
    hike.title
  );

  return {
    id: `${park.parkCode}-${slugify(hike.title)}`,
    name: hike.title,
    parkName: park.fullName,
    parkCode: park.parkCode,
    location: `${park.fullName}, ${park.states}`,
    state: park.states,
    description: hike.shortDescription.slice(0, 200),
    difficulty: estimateDifficulty(hike.shortDescription, hike.duration ?? ""),
    length: estimateLength(
      `${hike.shortDescription} ${hike.longDescription ?? ""}`,
      hike.duration ?? ""
    ),
    elevationGain: estimateElevation(hike.shortDescription),
    imageUrl,
    imageAlt,
    images,
    coordinates: { lat, lng },
    activities: hike.activities.map((a) => a.name),
  };
}

function buildTrailFromPark(park: NPSPark): Trail | null {
  const lat = parseFloat(park.latitude);
  const lng = parseFloat(park.longitude);

  if (isNaN(lat) || isNaN(lng)) return null;

  const { images, imageUrl, imageAlt } = collectImages(
    [],
    park.images ?? [],
    park.fullName
  );

  return {
    id: `${park.parkCode}-hiking`,
    name: `Hiking at ${park.fullName}`,
    parkName: park.fullName,
    parkCode: park.parkCode,
    location: `${park.fullName}, ${park.states}`,
    state: park.states,
    description: park.description.slice(0, 200),
    difficulty: "moderate",
    length: "Varies",
    elevationGain: "Varies",
    imageUrl,
    imageAlt,
    images,
    coordinates: { lat, lng },
    activities: ["Hiking"],
  };
}

async function main() {
  console.log("Fetching parks from NPS API...");
  const parks = await fetchParks();
  console.log(`Got ${parks.length} parks`);

  const seen = new Set<string>();
  const trails: Trail[] = [];

  for (const park of parks) {
    console.log(`Fetching things to do for ${park.fullName}...`);
    await Bun.sleep(1000);

    const things = await fetchThingsToDo(park.parkCode);
    const hikingThings = things.filter((t) =>
      t.activities.some(isHikingActivity)
    );

    if (hikingThings.length > 0) {
      for (const hike of hikingThings.slice(0, 10)) {
        const trail = buildTrailFromHike(hike, park);
        if (trail && !seen.has(trail.id)) {
          seen.add(trail.id);
          trails.push(trail);
        }
      }
    } else {
      const hasHiking = park.activities.some(isHikingActivity);
      if (hasHiking) {
        const trail = buildTrailFromPark(park);
        if (trail && !seen.has(trail.id)) {
          seen.add(trail.id);
          trails.push(trail);
        }
      }
    }
  }

  console.log(`\nTotal trails collected: ${trails.length}`);

  const outputPath = join(import.meta.dir, "..", "src", "data", "trails.json");
  await Bun.write(outputPath, JSON.stringify(trails, null, 2));
  console.log(`Written to ${outputPath}`);
}

main().catch(console.error);
