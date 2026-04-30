import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://tiles.stadiamaps.com";
// Server-side only — never sent to the browser
const API_KEY = process.env.STADIA_API_KEY;

// Cache tile data for 7 days, styles/sprites/fonts for 1 day.
// stale-while-revalidate lets the browser serve cached content immediately
// while fetching a fresh copy in the background.
function cacheHeaders(contentType: string): Record<string, string> {
  const isTile =
    contentType.includes("application/x-protobuf") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("image/");
  const maxAge = isTile ? 60 * 60 * 24 * 7 : 60 * 60 * 24; // 7d tiles, 1d rest
  const swr = isTile ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  return {
    "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Inject the API key as a query param on every upstream request
  const upstreamUrl = new URL(`${UPSTREAM}/${path.join("/")}`);
  if (API_KEY) upstreamUrl.searchParams.set("api_key", API_KEY);

  // Forward any query params the client sent (e.g. tile coordinates)
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "api_key") upstreamUrl.searchParams.set(key, value);
  });

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      // Next.js fetch cache — revalidate styles daily, tiles weekly
      next: { revalidate: path[0] === "styles" ? 86400 : 604800 },
    });
  } catch {
    return new NextResponse("Tile fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const isJson = contentType.includes("application/json") || path[path.length - 1]?.endsWith(".json");
  if (isJson) {
    const json = await upstream.text();
    const proxyBase = new URL("/api/tiles", request.url).toString();
    const rewritten = json.replaceAll(
      /https:\/\/tiles\.stadiamaps\.com\//g,
      `${proxyBase}/`
    );
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...cacheHeaders(contentType),
      },
    });
  }

  // Stream binary/text resources (tiles, fonts, sprites) straight through
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...cacheHeaders(contentType),
    },
  });
}
