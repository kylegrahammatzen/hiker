"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  MountainsIcon,
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
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const touchStart = useRef(0);

  const validImages = allImages.filter((img) => !failedUrls.has(img.url));
  const hasImages = validImages.length > 0;
  const currentImage = validImages[current] ?? validImages[0];
  const isCurrentLoaded = currentImage ? loadedUrls.has(currentImage.url) : false;

  useEffect(() => {
    if (current >= validImages.length && validImages.length > 0) {
      setCurrent(validImages.length - 1);
    }
  }, [current, validImages.length]);

  useEffect(() => {
    if (!hasImages && isFullscreenOpen) {
      setIsFullscreenOpen(false);
    }
  }, [hasImages, isFullscreenOpen]);

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
        {hasImages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreenOpen(true)}
            className="absolute right-2 top-2 rounded-full bg-black/40 px-2.5 text-white hover:bg-black/60 backdrop-blur-sm"
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
      {hasImages && currentImage?.caption && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">
          {currentImage.caption}
        </p>
      )}

      <DialogPrimitive.Root open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-3 sm:p-6">
            <DialogPrimitive.Popup className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/15 bg-black/95 text-white shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95">
              <DialogPrimitive.Title className="sr-only">{trail.name} image carousel</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Full-screen image carousel for this trail.
              </DialogPrimitive.Description>

              <DialogPrimitive.Close
                aria-label="Close full screen"
                className="absolute right-3 top-3 z-20"
                render={<Button size="icon-sm" variant="ghost" className="rounded-full bg-black/48 text-white hover:bg-black/72" />}
              >
                <XIcon />
              </DialogPrimitive.Close>

              <div
                className="relative h-[min(72vh,780px)] w-full bg-black"
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
                {!isCurrentLoaded && <div className="absolute inset-0 animate-pulse bg-white/8" />}

                {hasImages && (
                  <Image
                    key={`fullscreen-${currentImage!.url}`}
                    src={currentImage!.url}
                    alt={currentImage!.alt}
                    fill
                    unoptimized
                    className={cn("object-contain transition-opacity duration-200", isCurrentLoaded ? "opacity-100" : "opacity-0")}
                    onLoad={() => handleImageLoad(currentImage!.url)}
                    onError={() => handleImageError(currentImage!.url)}
                  />
                )}

                {hasImages && validImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/70"
                    >
                      <CaretLeftIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/70"
                    >
                      <CaretRightIcon />
                    </Button>
                  </>
                )}
              </div>

              {hasImages && validImages.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 border-t border-white/10 px-4 py-3">
                  {validImages.map((_, i) => (
                    <button
                      key={`fullscreen-dot-${i}`}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={cn(
                        "size-2 rounded-full transition-colors",
                        i === current ? "bg-white" : "bg-white/30"
                      )}
                    />
                  ))}
                </div>
              )}

              {hasImages && currentImage?.caption && (
                <p className="border-t border-white/10 px-4 py-3 text-center text-sm text-white/80 italic">
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

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <WarningIcon className="size-4" />
        Alerts
        <Badge variant="ghost" className="bg-destructive/16 text-destructive-foreground text-[10px] px-1.5 py-0">
          {data.alerts.length}
        </Badge>
      </h3>
      <div className="flex flex-col gap-1.5">
        {data.alerts.slice(0, 3).map((alert) => (
          <AlertBanner key={alert.id} alert={alert} />
        ))}
      </div>
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
  const [open, setOpen] = useState(false);

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
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            View more
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
              <DialogPrimitive.Popup className="relative w-full max-w-sm overflow-hidden rounded-xl border bg-background shadow-xl transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <DialogPrimitive.Title className="text-sm font-semibold">Forecast</DialogPrimitive.Title>
                  <DialogPrimitive.Close
                    aria-label="Close"
                    render={<Button size="icon-sm" variant="ghost" className="rounded-full" />}
                  >
                    <XIcon />
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Description className="sr-only">Extended weather forecast</DialogPrimitive.Description>
                <div className="grid grid-cols-2 gap-1.5 p-4">
                  {data.periods.map((period) => (
                    <WeatherPeriodCard key={period.name} period={period} />
                  ))}
                </div>
              </DialogPrimitive.Popup>
            </DialogPrimitive.Viewport>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
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
        <img
          src={species.photoUrl}
          alt=""
          className="size-3.5 rounded-sm object-cover"
          loading="lazy"
        />
      )}
      {titleCase(species.commonName)}
    </span>
  );
}

function WildlifeSection({ data, loading }: { data: WildlifeData | null; loading: boolean }) {
  const [open, setOpen] = useState(false);

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
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            View more
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
              <DialogPrimitive.Popup className="relative w-full max-w-sm max-h-[70vh] overflow-hidden rounded-xl border bg-background shadow-xl transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <DialogPrimitive.Title className="text-sm font-semibold">Wildlife Nearby</DialogPrimitive.Title>
                  <DialogPrimitive.Close
                    aria-label="Close"
                    render={<Button size="icon-sm" variant="ghost" className="rounded-full" />}
                  >
                    <XIcon />
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Description className="sr-only">Species observed near this trail</DialogPrimitive.Description>
                <div className="overflow-y-auto p-4 flex flex-col gap-3 max-h-[calc(70vh-3.25rem)]">
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
                </div>
              </DialogPrimitive.Popup>
            </DialogPrimitive.Viewport>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
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
