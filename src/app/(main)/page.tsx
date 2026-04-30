import { getTrails, getBoundaries } from "@/lib/trails";
import { MainApp } from "@/components/main-app";

export default async function Home({ searchParams }: { searchParams: Promise<{ park?: string }> }) {
  const params = await searchParams;
  const [trails, boundaries] = await Promise.all([getTrails(), getBoundaries()]);

  return <MainApp trails={trails} boundaries={boundaries} initialParkCode={params.park ?? null} />;
}
