import { getTrails, getBoundaries } from "@/lib/trails";
import { MapShell } from "@/components/map-shell";

export default async function Home({ searchParams }: { searchParams: Promise<{ park?: string }> }) {
  const params = await searchParams;
  const trails = getTrails();
  const boundaries = getBoundaries();

  return <MapShell trails={trails} boundaries={boundaries} initialParkCode={params.park ?? null} />;
}
