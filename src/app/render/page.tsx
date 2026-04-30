import type { Metadata } from "next";
import { getTrails, getBoundaries } from "@/lib/trails";
import { RenderMap } from "./render-map";

export const metadata: Metadata = {
  metadataBase: new URL("https://hiker.kylegm.com"),
  title: "Hiker Render View",
  description: "Static map render of U.S. National Park Service trail coverage.",
  openGraph: {
    title: "Hiker Render View",
    description: "Static map render of U.S. National Park Service trail coverage.",
    type: "website",
    images: [
      {
        url: "/og-render.webp",
        width: 1200,
        height: 630,
        alt: "Hiker render map preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hiker Render View",
    description: "Static map render of U.S. National Park Service trail coverage.",
    images: ["/og-render.webp"],
  },
};

export default async function RenderPage() {
  const [trails, boundaries] = await Promise.all([getTrails(), getBoundaries()]);

  return <RenderMap trails={trails} boundaries={boundaries} />;
}
