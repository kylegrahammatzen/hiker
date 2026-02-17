"use client";

import { useState, useEffect } from "react";
import { SearchX, ChevronRight, Mountain } from "lucide-react";
import type { Trail } from "@/lib/types";
import { TrailCard } from "@/components/trail-card";
import { useTrailStore } from "@/lib/store";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
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
  trails: Trail[];
};

function ParkSection({ group, isOpen, onToggle, selectedId, onSelect }: {
  group: ParkGroup;
  isOpen: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent group">
        <ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" />
        <Mountain className="size-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium truncate">{group.parkName}</span>
        <Badge variant="ghost" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
          {group.trails.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-1 py-1 pl-4">
          {group.trails.map((trail) => (
            <TrailCard
              key={trail.id}
              trail={trail}
              isSelected={selectedId === trail.id}
              onSelect={() => onSelect(trail.id)}
            />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

export function TrailList({ groups }: { groups: ParkGroup[] }) {
  const selectedId = useTrailStore((s) => s.selectedTrailId);
  const setSelected = useTrailStore((s) => s.setSelectedTrailId);
  const [openPark, setOpenPark] = useState<string | null>(() => {
    // Auto-open the first group if only one, or the selected trail's group
    if (groups.length === 1) return groups[0]!.parkName;
    if (selectedId) {
      const park = groups.find((g) => g.trails.some((t) => t.id === selectedId));
      if (park) return park.parkName;
    }
    return null;
  });

  // When groups change (map moved), close any open group that's no longer visible
  const groupNames = groups.map((g) => g.parkName);
  useEffect(() => {
    setOpenPark((prev) => {
      if (prev && !groupNames.includes(prev)) return null;
      return prev;
    });
  }, [groupNames.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a trail is selected, open its park group
  useEffect(() => {
    if (!selectedId) return;
    const park = groups.find((g) => g.trails.some((t) => t.id === selectedId));
    if (park) setOpenPark(park.parkName);
  }, [selectedId, groups]);

  if (groups.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
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
      {groups.map((group) => (
        <ParkSection
          key={group.parkName}
          group={group}
          isOpen={openPark === group.parkName}
          onToggle={() => {
            setOpenPark((prev) => prev === group.parkName ? null : group.parkName);
          }}
          selectedId={selectedId}
          onSelect={setSelected}
        />
      ))}
    </div>
  );
}
