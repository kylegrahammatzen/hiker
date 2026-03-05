import { type NextRequest, NextResponse } from "next/server";

interface NWSPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  icon: string;
  startTime: string;
}

export interface WeatherForecast {
  periods: {
    name: string;
    temp: number;
    unit: string;
    wind: string;
    windDir: string;
    short: string;
    detail: string;
    isDaytime: boolean;
    startTime: string;
  }[];
  location: string;
  elevation: { value: number; unit: string } | null;
}

const cache = new Map<string, { data: WeatherForecast; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const roundedLat = Number(parseFloat(lat).toFixed(4));
  const roundedLng = Number(parseFloat(lng).toFixed(4));
  const cacheKey = `${roundedLat},${roundedLng}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" },
    });
  }

  try {
    // Step 1: Get the forecast URL from NWS points endpoint
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${roundedLat},${roundedLng}`,
      {
        headers: { "User-Agent": "hiker-app (student-project)" },
        next: { revalidate: 86400 },
      }
    );

    if (!pointsRes.ok) {
      return NextResponse.json(
        { error: "Location not supported by NWS (US only)" },
        { status: pointsRes.status === 404 ? 404 : 502 }
      );
    }

    const points = await pointsRes.json();
    const forecastUrl: string = points.properties?.forecast;
    if (!forecastUrl) {
      return NextResponse.json({ error: "No forecast URL returned" }, { status: 502 });
    }

    // Step 2: Fetch the actual forecast
    const forecastRes = await fetch(forecastUrl, {
      headers: { "User-Agent": "hiker-app (student-project)" },
      next: { revalidate: 1800 },
    });

    if (!forecastRes.ok) {
      return NextResponse.json({ error: "Failed to fetch forecast" }, { status: 502 });
    }

    const forecast = await forecastRes.json();
    const periods: NWSPeriod[] = forecast.properties?.periods ?? [];

    const data: WeatherForecast = {
      periods: periods.slice(0, 6).map((p) => ({
        name: p.name,
        temp: p.temperature,
        unit: p.temperatureUnit,
        wind: p.windSpeed,
        windDir: p.windDirection,
        short: p.shortForecast,
        detail: p.detailedForecast,
        isDaytime: p.isDaytime,
        startTime: p.startTime,
      })),
      location: points.properties?.relativeLocation?.properties
        ? `${points.properties.relativeLocation.properties.city}, ${points.properties.relativeLocation.properties.state}`
        : "",
      elevation: points.properties?.elevation
        ? { value: Math.round(points.properties.elevation.value * 3.281), unit: "ft" }
        : null,
    };

    cache.set(cacheKey, { data, ts: Date.now() });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 502 });
  }
}
