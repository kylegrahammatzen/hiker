import { getTrails } from "@/lib/trails";
import { VisualMap } from "./visual-map";

export default async function VisualPage() {
  const trails = await getTrails();

  return <VisualMap trails={trails} />;
}
