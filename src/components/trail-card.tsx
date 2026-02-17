"use client";

import type { Trail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  PreviewCard,
  PreviewCardTrigger,
  PreviewCardPopup,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";
import { MapPin, TrendingUp, Ruler, Mountain } from "lucide-react";

type TrailCardProps = {
  trail: Trail;
  isSelected: boolean;
  onSelect: () => void;
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

export function TrailCard({ trail, isSelected, onSelect }: TrailCardProps) {
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={0}
        render={
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex flex-col gap-1 rounded-lg p-2 text-left transition-colors w-full",
              "hover:bg-sidebar-accent",
              isSelected && "bg-sidebar-accent ring-2 ring-primary/30"
            )}
          />
        }
      >
        <p className="text-sm font-medium leading-tight">
          {trail.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{trail.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ghost" className={cn("text-[10px] px-2 py-0", difficultyColor[trail.difficulty])}>
            {difficultyLabel[trail.difficulty]}
          </Badge>
          {trail.length !== "Varies" && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Ruler className="size-3" />
              {trail.length}
            </span>
          )}
          {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="size-3" />
              {trail.elevationGain}
            </span>
          )}
        </div>
      </PreviewCardTrigger>
      <PreviewCardPopup side="right" align="start" sideOffset={8} className="w-64">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium text-sm leading-tight">{trail.name}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {trail.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Badge variant="ghost" className={cn("text-[10px] px-2 py-0", difficultyColor[trail.difficulty])}>
              {difficultyLabel[trail.difficulty]}
            </Badge>
            {trail.length !== "Varies" && (
              <span className="flex items-center gap-1">
                <Ruler className="size-3" />
                {trail.length}
              </span>
            )}
            {trail.elevationGain !== "Varies" && trail.elevationGain !== "Minimal" && (
              <span className="flex items-center gap-1">
                <Mountain className="size-3" />
                {trail.elevationGain}
              </span>
            )}
          </div>
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
