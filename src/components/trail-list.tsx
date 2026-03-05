"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MagnifyingGlassMinusIcon, CaretRightIcon } from "@phosphor-icons/react";
import { TrailCard } from "@/components/trail-card";
import { useSelectedTrailId, useTrailActions } from "@/lib/trail-context";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { sortTrails, type ParkGroup, type GroupMode } from "@/lib/trail-grouping";

type Row =
  | { kind: "header"; group: ParkGroup }
  | { kind: "trail"; trail: ParkGroup["trails"][number]; parkName: string };

function buildRows(groups: ParkGroup[], openPark: string | null): Row[] {
  const rows: Row[] = [];

  for (const group of groups) {
    rows.push({ kind: "header", group });
    if (openPark === group.parkName) {
      for (const trail of sortTrails(group.trails)) {
        rows.push({ kind: "trail", trail, parkName: group.parkName });
      }
    }
  }

  return rows;
}

const HEADER_HEIGHT = 40;
const TRAIL_HEIGHT = 72;

export function TrailList({ groups, groupMode = "state" }: { groups: ParkGroup[]; groupMode?: GroupMode }) {
  const selectedId = useSelectedTrailId();
  const actions = useTrailActions();
  const viewportRef = useRef<HTMLDivElement>(null);

  // Auto-open the first group if there's only one, or the group containing the selected trail
  const [openPark, setOpenPark] = useState<string | null>(() => {
    if (groups.length === 1) return groups[0]!.parkName;
    if (selectedId) {
      const park = groups.find((g) => g.trails.some((t) => t.id === selectedId));
      if (park) return park.parkName;
    }
    return null;
  });

  // Keep openPark in sync when groups change
  const groupKey = groups.map((g) => g.parkName).join(",");
  useEffect(() => {
    setOpenPark((prev) => {
      if (!prev) return groups.length === 1 ? groups[0]!.parkName : null;
      if (!groups.some((g) => g.parkName === prev)) {
        return groups[0]?.parkName ?? null;
      }
      return prev;
    });
  }, [groupKey, groups]);

  // Open the group containing the selected trail
  useEffect(() => {
    if (!selectedId) return;
    const park = groups.find((g) => g.trails.some((t) => t.id === selectedId));
    if (park) setOpenPark(park.parkName);
  }, [selectedId, groups]);

  const rows = buildRows(groups, openPark);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? HEADER_HEIGHT : TRAIL_HEIGHT),
    overscan: 5,
  });

  const handleToggle = useCallback(
    (group: ParkGroup) => {
      const willOpen = openPark !== group.parkName;
      setOpenPark(willOpen ? group.parkName : null);
    },
    [openPark],
  );

  if (groups.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MagnifyingGlassMinusIcon />
          </EmptyMedia>
          <EmptyTitle>No trails found</EmptyTitle>
          <EmptyDescription>Try adjusting your search or zoom into the map.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea viewportRef={viewportRef} scrollbarGutter className="h-full">
      <div
        className="overflow-hidden"
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index]!;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {row.kind === "header" ? (
                <Collapsible
                  open={openPark === row.group.parkName}
                  onOpenChange={() => handleToggle(row.group)}
                >
                  <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-sidebar-accent overflow-hidden">
                    <CaretRightIcon
                      className="size-3 shrink-0 text-muted-foreground transition-transform"
                      style={{
                        transform: openPark === row.group.parkName ? "rotate(90deg)" : undefined,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium overflow-hidden">
                      {row.group.parkName}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-2 py-0">
                      {row.group.trails.length}
                    </Badge>
                  </CollapsibleTrigger>
                </Collapsible>
              ) : (
                <div className="relative ml-[11px] flex flex-col gap-1 pl-4 py-0.5">
                  <Separator orientation="vertical" className="absolute left-0 top-0 h-full" />
                  <TrailCard
                    trail={row.trail}
                    isSelected={selectedId === row.trail.id}
                    onSelect={() => actions.setSelectedTrailId(row.trail.id)}
                    showLocation={groupMode === "state"}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
