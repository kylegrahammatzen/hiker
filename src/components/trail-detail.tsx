"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { thumbHashToDataURL } from "thumbhash";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
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
  CaretLeftIcon,
  CaretRightIcon,
  ShareNetworkIcon,
  CheckIcon,
  ImageBrokenIcon,
  XIcon,
  CloudSunIcon,
  PawPrintIcon,
  WarningIcon,
  WindIcon,
  ThermometerIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import type { TrailImage as TrailImageType } from "@/lib/types";
import { useWeather, useWildlife, useAlerts } from "@/hooks/use-trail-data";
import type { WeatherForecast } from "@/app/api/weather/route";
import type { WildlifeData, WildlifeSpecies } from "@/app/api/wildlife/route";
import type { AlertsData, ParkAlert } from "@/app/api/alerts/route";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelDialog } from "@/components/ui/panel-dialog";

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

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

function thumbHashPlaceholder(thumbHash?: string): string | undefined {
  if (!thumbHash) return undefined;
  return thumbHashToDataURL(base64ToBytes(thumbHash));
}

function ImageGallery({ trail }: { trail: Trail }) {
  const allImages: TrailImageType[] =
    trail.images?.length > 0
      ? trail.images
      : [{ url: trail.imageUrl, alt: trail.imageAlt, caption: "" }];

  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [isFullscreenRequested, setIsFullscreenRequested] = useState(false);
  const touchStart = useRef(0);

  const validImages = allImages.filter((img) => !failedUrls.has(img.url));
  const hasImages = validImages.length > 0;
  const imageCount = validImages.length;
  const currentIndex = imageCount > 0 ? Math.min(current, imageCount - 1) : 0;
  const currentImage = validImages[currentIndex] ?? null;
  const isCurrentLoaded = currentImage ? loadedUrls.has(currentImage.url) : false;
  const isFullscreenOpen = hasImages && isFullscreenRequested;
  const placeholder = thumbHashPlaceholder(currentImage?.thumbHash);

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  const handleImageLoad = (url: string) => {
    setLoadedUrls((prev) => new Set(prev).add(url));
  };

  const prev = () => {
    if (imageCount <= 1) return;
    setCurrent((currentValue) => {
      const normalizedCurrent = Math.min(currentValue, imageCount - 1);
      return (normalizedCurrent - 1 + imageCount) % imageCount;
    });
  };

  const next = () => {
    if (imageCount <= 1) return;
    setCurrent((currentValue) => {
      const normalizedCurrent = Math.min(currentValue, imageCount - 1);
      return (normalizedCurrent + 1) % imageCount;
    });
  };

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
            {!isCurrentLoaded && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            <Image
              key={currentImage.url}
              src={currentImage.url}
              alt={currentImage.alt}
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              placeholder={placeholder ? "blur" : "empty"}
              blurDataURL={placeholder}
              className={cn("object-cover transition-opacity", isCurrentLoaded || placeholder ? "opacity-100" : "opacity-0")}
              onLoad={() => handleImageLoad(currentImage.url)}
              onError={() => handleImageError(currentImage.url)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageBrokenIcon className="size-12 text-muted-foreground/40" />
          </div>
        )}
        {hasImages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreenRequested(true)}
            className="absolute right-2 top-2 rounded-full border border-border/60 bg-background/80 px-2.5 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
          >
            Full screen
          </Button>
        )}
        {hasImages && validImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
            >
              <CaretLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
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
              className={cn("size-2 rounded-full transition-colors", i === currentIndex ? "bg-primary" : "bg-muted-foreground/30")}
            />
          ))}
        </div>
      )}
      {hasImages && currentImage?.caption && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">
          {currentImage.caption}
        </p>
      )}

      <DialogPrimitive.Root open={isFullscreenOpen} onOpenChange={setIsFullscreenRequested}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-background/75 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-3 sm:p-6">
            <DialogPrimitive.Popup className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95">
              <DialogPrimitive.Title className="sr-only">{trail.name} image carousel</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Full-screen image carousel for this trail.
              </DialogPrimitive.Description>

              <DialogPrimitive.Close
                aria-label="Close full screen"
                className="absolute right-3 top-3 z-20"
                render={<Button size="icon-sm" variant="ghost" className="rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95" />}
              >
                <XIcon />
              </DialogPrimitive.Close>

              <div
                className="relative h-[min(72vh,780px)] w-full bg-muted"
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
                {!isCurrentLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}

                {hasImages && (
                  <Image
                    key={`fullscreen-${currentImage.url}`}
                    src={currentImage.url}
                    alt={currentImage.alt}
                    fill
                    sizes="100vw"
                    placeholder={placeholder ? "blur" : "empty"}
                    blurDataURL={placeholder}
                    className={cn("object-contain transition-opacity duration-200", isCurrentLoaded || placeholder ? "opacity-100" : "opacity-0")}
                    onLoad={() => handleImageLoad(currentImage.url)}
                    onError={() => handleImageError(currentImage.url)}
                  />
                )}

                {hasImages && validImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
                    >
                      <CaretLeftIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
                    >
                      <CaretRightIcon />
                    </Button>
                  </>
                )}
              </div>

              {hasImages && validImages.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-3">
                  {validImages.map((_, i) => (
                    <button
                      key={`fullscreen-dot-${i}`}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={cn("size-2 rounded-full transition-colors", i === currentIndex ? "bg-primary" : "bg-muted-foreground/30")}
                    />
                  ))}
                </div>
              )}

              {hasImages && currentImage?.caption && (
                <p className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground italic">
                  {currentImage.caption}
                </p>
              )}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Viewport>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
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

function AlertBanner({ alert }: { alert: ParkAlert }) {
  const styles: Record<string, string> = {
    Danger: "border-destructive/30 bg-destructive/8 text-destructive-foreground",
    "Park Closure": "border-destructive/30 bg-destructive/8 text-destructive-foreground",
    Caution: "border-warning/30 bg-warning/8 text-warning-foreground",
    Information: "border-border bg-muted text-muted-foreground",
  };

  const icons: Record<string, typeof WarningIcon> = {
    Danger: WarningIcon,
    "Park Closure": WarningIcon,
    Caution: WarningIcon,
    Information: InfoIcon,
  };

  const Icon = icons[alert.category] ?? InfoIcon;

  return (
    <div className={cn("flex gap-2 rounded-lg border p-2.5", styles[alert.category])}>
      <Icon className="mt-0.5 size-4 shrink-0" weight="fill" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold leading-tight">{alert.title}</span>
        <span className="text-[11px] leading-snug opacity-80 line-clamp-3">{alert.description}</span>
      </div>
    </div>
  );
}

function alertPriority(category: string): number {
  if (category === "Park Closure") return 0;
  if (category === "Danger") return 1;
  if (category === "Caution") return 2;
  if (category === "Information") return 3;
  return 4;
}

function AlertsSection({ data, loading }: { data: AlertsData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <WarningIcon className="size-4" />
          Alerts
        </h3>
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (!data?.alerts.length) return null;

  const sortedAlerts = [...data.alerts].sort((a, b) => {
    const byPriority = alertPriority(a.category) - alertPriority(b.category);
    if (byPriority !== 0) return byPriority;
    return a.title.localeCompare(b.title);
  });

  const featuredAlert = sortedAlerts[0]!;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <WarningIcon className="size-4" />
          Alerts
        </h3>
        {sortedAlerts.length > 1 ? (
          <PanelDialog title="Park Alerts" description="All active alerts for this park">
            <div className="flex flex-col gap-2">
              {sortedAlerts.map((alert) => (
                <AlertBanner key={alert.id} alert={alert} />
              ))}
            </div>
          </PanelDialog>
        ) : null}
      </div>

      <AlertBanner alert={featuredAlert} />
    </div>
  );
}

function WeatherPeriodCard({ period }: { period: WeatherForecast["periods"][number] }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-2 text-center",
        period.isDaytime ? "bg-background" : "bg-muted/50"
      )}
    >
      <span className="text-[10px] font-medium text-muted-foreground leading-tight">{period.name}</span>
      <div className="flex items-center gap-0.5">
        <ThermometerIcon className="size-3 text-muted-foreground" />
        <span className="text-sm font-semibold tabular-nums">{period.temp}{period.unit === "F" ? "°F" : "°C"}</span>
      </div>
      <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{period.short}</span>
      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <WindIcon className="size-3" />
        <span>{period.wind}</span>
      </div>
    </div>
  );
}

function WeatherSection({ data, loading }: { data: WeatherForecast | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <CloudSunIcon className="size-4" />
          Weather
        </h3>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (!data?.periods.length) return null;

  const today = data.periods[0]!;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <CloudSunIcon className="size-4" />
          Weather
        </h3>
        <PanelDialog title="Forecast" description="Extended weather forecast" contentClassName="grid grid-cols-2 gap-1.5">
          {data.periods.map((period) => (
            <WeatherPeriodCard key={period.name} period={period} />
          ))}
        </PanelDialog>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold tabular-nums leading-none">{today.temp}{today.unit === "F" ? "°" : "°C"}</span>
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-medium">{today.short}</span>
          <span className="text-[11px] text-muted-foreground">{today.wind} {today.windDir}</span>
        </div>
      </div>
    </div>
  );
}

function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function SpeciesChip({ species }: { species: WildlifeSpecies }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
      {species.photoUrl && (
        <Image
          src={species.photoUrl}
          alt=""
          width={14}
          height={14}
          unoptimized
          className="size-3.5 rounded-sm object-cover"
          loading="lazy"
        />
      )}
      {titleCase(species.commonName)}
    </span>
  );
}

function WildlifeSection({ data, loading }: { data: WildlifeData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <PawPrintIcon className="size-4" />
          Wildlife Nearby
        </h3>
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-24 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.species.length) return null;

  const preview = data.species.slice(0, 3);

  const grouped = new Map<string, WildlifeSpecies[]>();
  for (const s of data.species) {
    const group = grouped.get(s.group) ?? [];
    group.push(s);
    grouped.set(s.group, group);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <PawPrintIcon className="size-4" />
          Wildlife Nearby
        </h3>
        <PanelDialog title="Wildlife Nearby" description="Species observed near this trail" contentClassName="flex flex-col gap-3">
          {Array.from(grouped.entries()).map(([group, species]) => (
            <div key={group} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group}</span>
              <div className="flex flex-wrap gap-1">
                {species.map((s) => (
                  <SpeciesChip key={s.id} species={s} />
                ))}
              </div>
            </div>
          ))}
        </PanelDialog>
      </div>
      <div className="flex flex-wrap gap-1">
        {preview.map((s) => (
          <SpeciesChip key={s.id} species={s} />
        ))}
      </div>
    </div>
  );
}

function NearbyTrailRow({ trail, distance, onSelect }: { trail: Trail; distance: number; onSelect: () => void }) {
  const distanceText = Number.isFinite(distance) 
    ? distance < 0.1 ? "< 0.1 mi away" : `${distance.toFixed(1)} mi away`
    : null;

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
        {distanceText && (
          <span className="text-[10px] text-muted-foreground">{distanceText}</span>
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

  const alerts = useAlerts(trail.parkCode);
  const weather = useWeather(trail.coordinates?.lat, trail.coordinates?.lng);
  const wildlife = useWildlife(trail.coordinates?.lat, trail.coordinates?.lng);

  const DIFFICULTY_ORDER = { easy: 0, moderate: 1, hard: 2 } as const;
  const sortedNearby = nearbyTrails
    ?.map((t) => ({ trail: t, distance: getDistance(trail, t) }))
    .sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > 0.1) return a.distance - b.distance;
      const diffA = DIFFICULTY_ORDER[a.trail.difficulty];
      const diffB = DIFFICULTY_ORDER[b.trail.difficulty];
      if (diffA !== diffB) return diffA - diffB;
      const lenA = parseFloat(a.trail.length) || 0;
      const lenB = parseFloat(b.trail.length) || 0;
      return lenA - lenB;
    });

  return (
    <div className="flex flex-col">
      <ImageGallery key={trail.id} trail={trail} />
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

        <AlertsSection data={alerts.data} loading={alerts.loading} />

        <Separator />

        <WeatherSection data={weather.data} loading={weather.loading} />

        <WildlifeSection data={wildlife.data} loading={wildlife.loading} />

        {sortedNearby && sortedNearby.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">More in {trail.parkName}</h3>
              <div className="-mx-2 flex flex-col">
                {sortedNearby.map(({ trail: t, distance }) => (
                  <NearbyTrailRow
                    key={t.id}
                    trail={t}
                    distance={distance}
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
