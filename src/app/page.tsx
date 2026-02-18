import { getTrails } from "@/lib/trails";
import { MapShell } from "@/components/map-shell";

export default async function Home({ searchParams }: { searchParams: Promise<{ park?: string }> }) {
  const params = await searchParams;
  const trails = getTrails();

  return <MapShell trails={trails} initialParkCode={params.park ?? null} />;
}
