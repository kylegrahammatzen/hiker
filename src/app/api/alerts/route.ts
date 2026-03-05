import { type NextRequest, NextResponse } from "next/server";

const NPS_API_KEY = process.env.NPS_API_KEY;

interface NPSAlert {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  parkCode: string;
  lastIndexedDate: string;
}

export interface ParkAlert {
  id: string;
  title: string;
  description: string;
  category: "Danger" | "Caution" | "Information" | "Park Closure";
  url: string;
  date: string;
}

export interface AlertsData {
  alerts: ParkAlert[];
}

const cache = new Map<string, { data: AlertsData; ts: number }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parkCode = searchParams.get("parkCode");

  if (!parkCode) {
    return NextResponse.json({ error: "parkCode required" }, { status: 400 });
  }

  if (!NPS_API_KEY) {
    return NextResponse.json({ error: "NPS API key not configured" }, { status: 500 });
  }

  const cacheKey = parkCode.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=1800" },
    });
  }

  try {
    const url = new URL("https://developer.nps.gov/api/v1/alerts");
    url.searchParams.set("parkCode", parkCode);
    url.searchParams.set("api_key", NPS_API_KEY);
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), { next: { revalidate: 900 } });

    if (!res.ok) {
      return NextResponse.json({ error: "NPS alerts request failed" }, { status: 502 });
    }

    const json = await res.json();
    const npsAlerts: NPSAlert[] = json.data ?? [];

    const CATEGORY_ORDER: Record<string, number> = {
      Danger: 0,
      "Park Closure": 1,
      Caution: 2,
      Information: 3,
    };

    const alerts: ParkAlert[] = npsAlerts
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: (a.category || "Information") as ParkAlert["category"],
        url: a.url,
        date: a.lastIndexedDate,
      }))
      .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));

    const data: AlertsData = { alerts };
    cache.set(cacheKey, { data, ts: Date.now() });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=1800" },
    });
  } catch {
    return NextResponse.json({ error: "Alerts fetch failed" }, { status: 502 });
  }
}
