import trailData from "@/data/trails.json";
import boundaryData from "@/data/boundaries.json";
import type { Trail } from "./types";

export function getTrails(): Trail[] {
  return trailData as Trail[];
}

export function getBoundaries(): GeoJSON.FeatureCollection {
  return boundaryData as unknown as GeoJSON.FeatureCollection;
}

export function getTrailById(id: string): Trail | undefined {
  return (trailData as Trail[]).find((t) => t.id === id);
}

export function getTrailsGeoJSON() {
  const trails = getTrails();
  return {
    type: "FeatureCollection" as const,
    features: trails.map((trail) => ({
      type: "Feature" as const,
      properties: {
        id: trail.id,
        name: trail.name,
        parkName: trail.parkName,
        difficulty: trail.difficulty,
        length: trail.length,
        elevationGain: trail.elevationGain,
        imageUrl: trail.imageUrl,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [trail.coordinates.lng, trail.coordinates.lat],
      },
    })),
  };
}
