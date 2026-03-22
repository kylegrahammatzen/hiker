# Hiker

[![React Doctor](https://www.react.doctor/share/badge?p=hiker&s=100)](https://www.react.doctor/share?p=hiker&s=100)
[![Bun](https://img.shields.io/badge/Bun-1.3+-black.svg)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

Hiker is an interactive trail explorer for U.S. National Parks. It pulls trail data from the NPS API, pairs it with live weather from NWS, wildlife observations from iNaturalist, and park alerts, then layers everything onto a MapLibre GL map you can search, filter, and zoom through.

## Features

- Interactive satellite map with clustering, spiderfying, and park boundary overlays
- Search and filter trails by name, park, or state
- Trail details with difficulty, elevation, distance, images, and descriptions
- Live weather forecasts, wildlife sightings, and park alerts per trail
- Group trails by state or by park with color-coded markers
- Statistical visualizations of trail distribution by state and difficulty
- Static map rendering with OG image generation for link previews
- Dark and light theme support

## Getting Started

```bash
git clone https://github.com/kylegrahammatzen/hiker.git
cd hiker
bun install
```

### Fetch trail data

The data pipeline pulls trails, boundaries, and metadata from the NPS API.

```bash
bun run fetch:all
```

Or run each step individually:

```bash
bun run fetch            # Trail metadata and coordinates
bun run fetch:boundaries # Park boundary polygons
bun run fetch:clean      # Data cleanup
```

### Development

```bash
bun dev
```

### Production

```bash
bun run build
bun start
```

## Routes

| Route | Description |
| --- | --- |
| `/` | Interactive map with trail search and detail panels |
| `/visual` | Statistical charts with autoplay state cycling |
| `/render` | Static map render with OG image output |
