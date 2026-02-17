import { getTrails } from "@/lib/trails";
import { MapShell } from "@/components/map-shell";

export default function Home() {
  const trails = getTrails();

  return <MapShell trails={trails} />;
}
