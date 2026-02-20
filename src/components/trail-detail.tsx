"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Trail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTrailActions } from "@/lib/trail-context";
import { cn } from "@/lib/utils";
import {
  MapPinIcon,
  TrendUpIcon,
  RulerIcon,
  MountainsIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ShareNetworkIcon,
  CheckIcon,
  ImageBrokenIcon,
} from "@phosphor-icons/react";
import type { TrailImage as TrailImageType } from "@/lib/types";

const difficultyColor = {
  easy: "bg-success/16 text-success-foreground",
  moderate: "bg-warning/16 text-warning-foreground",
  hard: "bg-destructive/16 text-destructive-foreground",
};

const difficultyLabel = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

function ImageGallery({ trail }: { trail: Trail }) {
  const allImages: TrailImageType[] =
    trail.images?.length > 0
      ? trail.images
      : [{ url: trail.imageUrl, alt: trail.imageAlt, caption: "" }];
  
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(0);

  const validImages = allImages.filter((img) => !failedUrls.has(img.url));
  const hasImages = validImages.length > 0;
  const currentImage = validImages[current];
  const isCurrentLoaded = currentImage ? loadedUrls.has(currentImage.url) : false;

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  const handleImageLoad = (url: string) => {
    setLoadedUrls((prev) => new Set(prev).add(url));
  };

  const prev = () => setCurrent((c) => (c - 1 + validImages.length) % validImages.length);
  const next = () => setCurrent((c) => (c + 1) % validImages.length);

  return (
    <div className="relative w-full">
      <div
        className="relative h-48 w-full overflow-hidden bg-muted"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]!.clientX;
        }}
        onTouchEnd={(e) => {
          if (!hasImages || validImages.length <= 1) return;
          const delta = e.changedTouches[0]!.clientX - touchStart.current;
          if (delta > 50) prev();
          if (delta < -50) next();
        }}
      >
        {hasImages ? (
          <>
            {/* Skeleton while loading */}
            {!isCurrentLoaded && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            <Image
              key={currentImage!.url}
              src={currentImage!.url}
              alt={currentImage!.alt}
              fill
              unoptimized
              priority
              className={cn("object-cover transition-opacity", isCurrentLoaded ? "opacity-100" : "opacity-0")}
              onLoad={() => handleImageLoad(currentImage!.url)}
              onError={() => handleImageError(currentImage!.url)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageBrokenIcon className="size-12 text-muted-foreground/40" />
          </div>
        )}
        {hasImages && validImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
            >
              <CaretLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
            >
              <CaretRightIcon />
            </Button>
          </>
        )}
      </div>
      {hasImages && validImages.length > 1 && (
        <div className="flex justify-center gap-1 py-2">
          {validImages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === current ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
      {hasImages && validImages[current]?.caption && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">
          {validImages[current]!.caption}
        </p>
      )}
    </div>
  );
}

function ShareButton({ trailId }: { trailId: string }) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}#${trailId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      {copied ? <CheckIcon /> : <ShareNetworkIcon />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}

function NearbyTrailRow({ trail, onSelect }: { trail: Trail; onSelect: () => void }) {
  return (
    <Button
      variant="ghost"
      className="h-auto w-full flex-col items-start gap-1 rounded-lg p-2 text-left"
      onClick={onSelect}
    >
      <span className="w-full min-w-0 text-sm font-medium leading-tight break-words">{trail.name}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="ghost" className={cn("text-[10px] px-2 py-0", difficultyColor[trail.difficulty])}>
          {difficultyLabel[trail.difficulty]}
        </Badge>
        {trail.length !== "Varies" && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <RulerIcon className="size-3" />
            {trail.length}
          </span>
        )}
      </div>
    </Button>
  );
}

function getDistance(a: Trail, b: Trail): number {
  // Return large number if coordinates are missing/invalid
  if (!a.coordinates || !b.coordinates) return Infinity;
  if (!Number.isFinite(a.coordinates.lat) || !Number.isFinite(a.coordinates.lng)) return Infinity;
  if (!Number.isFinite(b.coordinates.lat) || !Number.isFinite(b.coordinates.lng)) return Infinity;
  
  const R = 3959; // Earth's radius in miles
  const dLat = ((b.coordinates.lat - a.coordinates.lat) * Math.PI) / 180;
  const dLng = ((b.coordinates.lng - a.coordinates.lng) * Math.PI) / 180;
  const lat1 = (a.coordinates.lat * Math.PI) / 180;
  const lat2 = (b.coordinates.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function TrailDetail({
  trail,
  nearbyTrails,
}: {
  trail: Trail;
  nearbyTrails?: Trail[];
}) {
  const actions = useTrailActions();

  // Sort nearby trails by distance from current trail
  const sortedNearby = nearbyTrails
    ?.map((t) => ({ trail: t, distance: getDistance(trail, t) }))
    .sort((a, b) => a.distance - b.distance)
    .map((x) => x.trail);

  return (
    <div className="flex flex-col">
      <ImageGallery trail={trail} />
      <div className="flex flex-col gap-2 p-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold leading-tight">{trail.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" />
            <span>{trail.location}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{trail.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <Badge variant="ghost" className={difficultyColor[trail.difficulty]}>
              {difficultyLabel[trail.difficulty]}
            </Badge>
            {trail.length !== "Varies" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RulerIcon className="size-4" />
                <span>{trail.length}</span>
              </div>
            )}
            {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendUpIcon className="size-4" />
                <span>{trail.elevationGain}</span>
              </div>
            )}
          </div>
          <ShareButton trailId={trail.id} />
        </div>

        {sortedNearby && sortedNearby.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">More in {trail.parkName}</h3>
              <div className="-mx-2 flex flex-col">
                {sortedNearby.map((t) => (
                  <NearbyTrailRow
                    key={t.id}
                    trail={t}
                    onSelect={() => actions.setSelectedTrailId(t.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
