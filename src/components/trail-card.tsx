"use client";

import type { Trail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PreviewCard,
  PreviewCardTrigger,
  PreviewCardPopup,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";
import { MapPinIcon, TrendUpIcon, RulerIcon, MountainsIcon } from "@phosphor-icons/react";

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

export function TrailCard({
  trail,
  isSelected,
  onSelect,
  showLocation = true,
}: {
  trail: Trail;
  isSelected: boolean;
  onSelect: () => void;
  showLocation?: boolean;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <Button
            variant="ghost"
            onClick={onSelect}
            className={cn(
              "h-auto w-full min-w-0 flex-col items-start gap-1 rounded-lg p-2 text-left",
              isSelected && "bg-sidebar-accent ring-2 ring-primary/30"
            )}
          />
        }
      >
        <p className="w-full min-w-0 text-sm font-medium leading-tight break-words">{trail.name}</p>
        {showLocation && (
          <div className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{trail.location}</span>
          </div>
        )}
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
          {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendUpIcon className="size-3" />
              {trail.elevationGain}
            </span>
          )}
        </div>
      </PreviewCardTrigger>
      <PreviewCardPopup side="right" align="start" sideOffset={8} className="w-64">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium leading-tight">{trail.name}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{trail.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Badge variant="ghost" className={cn("text-[10px] px-2 py-0", difficultyColor[trail.difficulty])}>
              {difficultyLabel[trail.difficulty]}
            </Badge>
            {trail.length !== "Varies" && (
              <span className="flex items-center gap-1">
                <RulerIcon className="size-3" />
                {trail.length}
              </span>
            )}
            {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
              <span className="flex items-center gap-1">
                <MountainsIcon className="size-3" />
                {trail.elevationGain}
              </span>
            )}
          </div>
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
