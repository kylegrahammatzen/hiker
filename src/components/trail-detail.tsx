"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Trail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTrailStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MapPin, TrendingUp, Ruler, Mountain, ChevronLeft, ChevronRight, Share2, Check } from "lucide-react";

type TrailDetailProps = {
  trail: Trail;
  nearbyTrails?: Trail[];
};

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
  const images = trail.images?.length > 0
    ? trail.images
    : [{ url: trail.imageUrl, alt: trail.imageAlt, caption: "" }];
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(0);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <div className="relative w-full">
      <div
        className="relative h-48 w-full overflow-hidden"
        onTouchStart={(e) => { touchStart.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0]!.clientX - touchStart.current;
          if (delta > 50) prev();
          if (delta < -50) next();
        }}
      >
        <Image
          src={images[current]!.url}
          alt={images[current]!.alt}
          fill
          sizes="352px"
          className="object-cover"
          priority={current === 0}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1 py-2">
          {images.map((_, i) => (
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
      {images[current]!.caption && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">
          {images[current]!.caption}
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
    <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleShare}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}

export function TrailDetail({ trail, nearbyTrails }: TrailDetailProps) {
  const setSelected = useTrailStore((s) => s.setSelectedTrailId);

  return (
    <div className="flex flex-col">
      <ImageGallery trail={trail} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-tight">{trail.name}</h2>
            <ShareButton trailId={trail.id} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span>{trail.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="ghost" className={difficultyColor[trail.difficulty]}>
            {difficultyLabel[trail.difficulty]}
          </Badge>
          {trail.length !== "Varies" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ruler className="size-4" />
              <span>{trail.length}</span>
            </div>
          )}
          {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" />
              <span>{trail.elevationGain}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">About</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {trail.description}
          </p>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Park</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mountain className="size-4 shrink-0" />
            <span>{trail.parkName}</span>
          </div>
        </div>

        {trail.activities.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Activities</h3>
              <div className="flex flex-wrap gap-2">
                {trail.activities.map((activity) => (
                  <Badge key={activity} variant="outline">
                    {activity}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {nearbyTrails && nearbyTrails.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">More in {trail.parkName}</h3>
              <div className="flex flex-col gap-1">
                {nearbyTrails.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className="flex items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent"
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded">
                      <Image
                        src={t.imageUrl}
                        alt={t.imageAlt}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-0 min-w-0">
                      <span className="text-xs font-medium leading-tight truncate">{t.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Badge variant="ghost" className={cn("text-[10px] px-1 py-0", difficultyColor[t.difficulty])}>
                          {difficultyLabel[t.difficulty]}
                        </Badge>
                        {t.length !== "Varies" && <span>{t.length}</span>}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
