"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlassMinusIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { Trail } from "@/lib/types";
import { TrailCard } from "@/components/trail-card";
import { useSelectedTrailId, trailActions } from "@/lib/store";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type ParkGroup = {
  parkName: string;
  parkCode: string;
  trails: Trail[];
};

function ParkSection({ group, isOpen, onToggle, selectedId, onSelect }: {
  group: ParkGroup;
  isOpen: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const difficultyOrder = { easy: 0, moderate: 1, hard: 2 };
  const sortedTrails = [...group.trails].sort((a, b) => {
    const diffDiff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    if (diffDiff !== 0) return diffDiff;
    const aMiles = parseFloat(a.length) || 0;
    const bMiles = parseFloat(b.length) || 0;
    return aMiles - bMiles;
  });

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent group">
        <CaretRightIcon className="size-3 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" />
        <span className="flex-1 text-xs font-medium truncate">{group.parkName}</span>
        <Badge variant="secondary" className="text-[10px] px-2 py-0">
          {group.trails.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="relative ml-[11px] flex flex-col gap-1 pl-4">
          <Separator orientation="vertical" className="absolute left-0 top-0 h-full" />
          {sortedTrails.map((trail) => (
            <TrailCard
              key={trail.id}
              trail={trail}
              isSelected={selectedId === trail.id}
              onSelect={() => onSelect(trail.id)}
              showLocation={false}
            />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function SingleTrail({ trail, selectedId, onSelect }: {
  trail: Trail;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-muted-foreground">
        <span className="flex-1 text-xs font-medium truncate">{trail.parkName}</span>
      </div>
      <div className="relative ml-[11px] pl-4">
        <Separator orientation="vertical" className="absolute left-0 top-0 h-full" />
        <TrailCard
          trail={trail}
          isSelected={selectedId === trail.id}
          onSelect={() => onSelect(trail.id)}
        />
      </div>
    </div>
  );
}

export function TrailList({ groups }: { groups: ParkGroup[] }) {
  const selectedId = useSelectedTrailId();

  const sorted = [...groups].sort((a, b) => b.trails.length - a.trails.length);
  const multiGroups = sorted.filter((g) => g.trails.length > 1);
  const singles = sorted.filter((g) => g.trails.length === 1);
  const onlySingles = multiGroups.length === 0;

  const singlesGroup: ParkGroup | null = !onlySingles && singles.length > 0
    ? { parkName: "Other Parks", parkCode: "other", trails: singles.map((g) => g.trails[0]!) }
    : null;

  const [openPark, setOpenPark] = useState<string | null>(() => {
    if (multiGroups.length === 1) return multiGroups[0]!.parkName;
    if (selectedId) {
      const park = multiGroups.find((g) => g.trails.some((t) => t.id === selectedId));
      if (park) return park.parkName;
      if (singlesGroup?.trails.some((t) => t.id === selectedId)) return "Other Parks";
    }
    return null;
  });

  const groupNames = sorted.map((g) => g.parkName);
  useEffect(() => {
    setOpenPark((prev) => {
      if (!prev) return null;
      if (prev === "Other Parks" && singlesGroup) return prev;
      if (!groupNames.includes(prev)) return null;
      return prev;
    });
  }, [groupNames.join(","), singlesGroup !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    const park = multiGroups.find((g) => g.trails.some((t) => t.id === selectedId));
    if (park) {
      setOpenPark(park.parkName);
      return;
    }
    if (singlesGroup?.trails.some((t) => t.id === selectedId)) {
      setOpenPark("Other Parks");
    }
  }, [selectedId, multiGroups, singlesGroup]);

  if (sorted.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MagnifyingGlassMinusIcon />
          </EmptyMedia>
          <EmptyTitle>No trails found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or zoom into the map.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {multiGroups.map((group) => (
        <ParkSection
          key={group.parkName}
          group={group}
          isOpen={openPark === group.parkName}
          onToggle={() => {
            const willOpen = openPark !== group.parkName;
            setOpenPark(willOpen ? group.parkName : null);
            trailActions.setFocusedParkCode(willOpen ? group.parkCode : null);
          }}
          selectedId={selectedId}
          onSelect={trailActions.setSelectedTrailId}
        />
      ))}
      {singlesGroup && (
        <ParkSection
          key="Other Parks"
          group={singlesGroup}
          isOpen={openPark === "Other Parks"}
          onToggle={() => {
            const willOpen = openPark !== "Other Parks";
            setOpenPark(willOpen ? "Other Parks" : null);
            trailActions.setFocusedParkCode(null);
          }}
          selectedId={selectedId}
          onSelect={trailActions.setSelectedTrailId}
        />
      )}
      {onlySingles && singles.map((group) => (
        <SingleTrail
          key={group.trails[0]!.id}
          trail={group.trails[0]!}
          selectedId={selectedId}
          onSelect={trailActions.setSelectedTrailId}
        />
      ))}
    </div>
  );
}
