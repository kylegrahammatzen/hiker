import { join } from "path";
import type { Trail } from "../lib/types";

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

const HIKING_PARKS = [
  "yose", "grca", "zion", "romo", "grsm", "glac", "shen", "acad",
  "olym", "mora", "seki", "brca", "arch", "cany", "grte", "dena",
  "jotr", "havo", "neri", "badl", "grsa", "meve", "blca", "crla",
  "redw", "pinn", "indu", "cuva", "viis", "bibe",
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

function buildTrailFromHike(
  id: number,
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

  return {
    id: `trail-${id}`,
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
    imageUrl:
      hike.images?.[0]?.url ??
      park.images?.[0]?.url ??
      "/images/trails/default.jpg",
    imageAlt:
      hike.images?.[0]?.altText ??
      park.images?.[0]?.altText ??
      hike.title,
    coordinates: { lat, lng },
    activities: hike.activities.map((a) => a.name),
  };
}

function buildTrailFromPark(id: number, park: NPSPark): Trail | null {
  const lat = parseFloat(park.latitude);
  const lng = parseFloat(park.longitude);

  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    id: `trail-${id}`,
    name: `Hiking at ${park.fullName}`,
    parkName: park.fullName,
    parkCode: park.parkCode,
    location: `${park.fullName}, ${park.states}`,
    state: park.states,
    description: park.description.slice(0, 200),
    difficulty: "moderate",
    length: "Varies",
    elevationGain: "Varies",
    imageUrl: park.images?.[0]?.url ?? "/images/trails/default.jpg",
    imageAlt: park.images?.[0]?.altText ?? park.fullName,
    coordinates: { lat, lng },
    activities: ["Hiking"],
  };
}

async function main() {
  console.log("Fetching parks from NPS API...");
  const parks = await fetchParks();
  console.log(`Got ${parks.length} parks`);

  const trails: Trail[] = [];
  let trailId = 0;

  for (const park of parks) {
    console.log(`Fetching things to do for ${park.fullName}...`);
    await Bun.sleep(1000);

    const things = await fetchThingsToDo(park.parkCode);
    const hikingThings = things.filter((t) =>
      t.activities.some(isHikingActivity)
    );

    if (hikingThings.length > 0) {
      for (const hike of hikingThings.slice(0, 3)) {
        const trail = buildTrailFromHike(++trailId, hike, park);
        if (trail) trails.push(trail);
      }
    } else {
      const hasHiking = park.activities.some(isHikingActivity);
      if (hasHiking) {
        const trail = buildTrailFromPark(++trailId, park);
        if (trail) trails.push(trail);
      }
    }
  }

  console.log(`\nTotal trails collected: ${trails.length}`);

  const outputPath = join(import.meta.dir, "..", "data", "trails.json");
  await Bun.write(outputPath, JSON.stringify(trails, null, 2));
  console.log(`Written to ${outputPath}`);
}

main().catch(console.error);
