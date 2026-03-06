import { getTrails, getBoundaries } from "@/lib/trails";
import { RenderMap } from "./render-map";

export default function RenderPage() {
  const trails = getTrails();
  const boundaries = getBoundaries();

  return <RenderMap trails={trails} boundaries={boundaries} />;
}
