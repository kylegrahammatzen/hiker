export type TrailImage = {
  url: string;
  alt: string;
  caption: string;
};

export type Trail = {
  id: string;
  name: string;
  parkName: string;
  parkCode: string;
  location: string;
  state: string;
  description: string;
  difficulty: "easy" | "moderate" | "hard";
  length: string;
  elevationGain: string;
  imageUrl: string;
  imageAlt: string;
  images: TrailImage[];
  coordinates: {
    lat: number;
    lng: number;
  };
  activities: string[];
};

export type ParkBoundary = {
  type: "Feature";
  properties: {
    name: string;
    parkCode: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type LayerVisibility = {
  markers: boolean;
  boundaries: boolean;
  clusters: boolean;
  heatmap: boolean;
  terrain: boolean;
  contours: boolean;
};
