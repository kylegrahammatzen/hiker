import { getTrails, getBoundaries } from "@/lib/trails";
import { MainApp } from "@/components/main-app";

export default async function Home() {
  const [trails, boundaries] = await Promise.all([getTrails(), getBoundaries()]);

  return <MainApp trails={trails} boundaries={boundaries} />;
}
