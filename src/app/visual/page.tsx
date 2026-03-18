import { getTrails } from "@/lib/trails";
import { VisualMap } from "./visual-map";

export default function VisualPage() {
  const trails = getTrails();

  return <VisualMap trails={trails} />;
}
