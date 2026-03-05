import { type NextRequest, NextResponse } from "next/server";

interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  default_photo?: { square_url?: string };
  wikipedia_url?: string;
}

interface INatResult {
  count: number;
  taxon: INatTaxon;
}

export interface WildlifeSpecies {
  id: number;
  name: string;
  commonName: string;
  group: string;
  count: number;
  photoUrl: string | null;
  wikiUrl: string | null;
}

export interface WildlifeData {
  species: WildlifeSpecies[];
  totalObservations: number;
}

const cache = new Map<string, { data: WildlifeData; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

const GROUP_ORDER: Record<string, number> = {
  Mammalia: 0,
  Aves: 1,
  Reptilia: 2,
  Amphibia: 3,
  Actinopterygii: 4,
  Insecta: 5,
  Arachnida: 6,
  Plantae: 7,
  Fungi: 8,
};

const GROUP_LABELS: Record<string, string> = {
  Mammalia: "Mammals",
  Aves: "Birds",
  Reptilia: "Reptiles",
  Amphibia: "Amphibians",
  Actinopterygii: "Fish",
  Insecta: "Insects",
  Arachnida: "Arachnids",
  Plantae: "Plants",
  Fungi: "Fungi",
  Mollusca: "Mollusks",
  Chromista: "Chromista",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") ?? "10"; // km

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const roundedLat = parseFloat(lat).toFixed(3);
  const roundedLng = parseFloat(lng).toFixed(3);
  const cacheKey = `${roundedLat},${roundedLng},${radius}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=43200" },
    });
  }

  try {
    // iNaturalist: species_counts within a radius of the coordinate
    // Only research-grade observations for quality
    const url = new URL("https://api.inaturalist.org/v1/observations/species_counts");
    url.searchParams.set("lat", roundedLat);
    url.searchParams.set("lng", roundedLng);
    url.searchParams.set("radius", radius);
    url.searchParams.set("quality_grade", "research");
    url.searchParams.set("per_page", "30");
    url.searchParams.set("order_by", "count");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "hiker-app (student-project)" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "iNaturalist request failed" }, { status: 502 });
    }

    const json = await res.json();
    const results: INatResult[] = json.results ?? [];

    const species: WildlifeSpecies[] = results
      .filter((r) => r.taxon.preferred_common_name)
      .map((r) => ({
        id: r.taxon.id,
        name: r.taxon.name,
        commonName: r.taxon.preferred_common_name!,
        group: GROUP_LABELS[r.taxon.iconic_taxon_name ?? ""] ?? r.taxon.iconic_taxon_name ?? "Other",
        count: r.count,
        photoUrl: r.taxon.default_photo?.square_url ?? null,
        wikiUrl: r.taxon.wikipedia_url ?? null,
      }))
      .sort((a, b) => {
        const groupA = GROUP_ORDER[Object.entries(GROUP_LABELS).find(([, v]) => v === a.group)?.[0] ?? ""] ?? 99;
        const groupB = GROUP_ORDER[Object.entries(GROUP_LABELS).find(([, v]) => v === b.group)?.[0] ?? ""] ?? 99;
        if (groupA !== groupB) return groupA - groupB;
        return b.count - a.count;
      });

    const data: WildlifeData = {
      species,
      totalObservations: json.total_results ?? 0,
    };

    cache.set(cacheKey, { data, ts: Date.now() });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=43200" },
    });
  } catch {
    return NextResponse.json({ error: "Wildlife fetch failed" }, { status: 502 });
  }
}
