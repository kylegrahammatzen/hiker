"use client";

import { useState, useRef } from "react";
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
import { HighlightedText } from "@/components/highlighted-text";

type Row =
  | { kind: "header"; group: ParkGroup }
  | { kind: "trail"; trail: ParkGroup["trails"][number]; parkName: string };

function buildRows(groups: ParkGroup[], openPark: string | null, searchActive: boolean): Row[] {
  const rows: Row[] = [];

  for (const group of groups) {
    rows.push({ kind: "header", group });
    if (searchActive || openPark === group.parkName) {
      for (const trail of sortTrails(group.trails)) {
        rows.push({ kind: "trail", trail, parkName: group.parkName });
      }
    }
  }

  return rows;
}

const HEADER_HEIGHT = 40;
const TRAIL_HEIGHT = 72;

export function TrailList({
  groups,
  groupMode = "state",
  focusedParkCode,
  searchQuery = "",
}: {
  groups: ParkGroup[];
  groupMode?: GroupMode;
  focusedParkCode?: string | null;
  searchQuery?: string;
}) {
  "use no memo";

  const selectedId = useSelectedTrailId();
  const actions = useTrailActions();
  const viewportRef = useRef<HTMLDivElement>(null);

  const [manualOpenPark, setManualOpenPark] = useState<string | null>(null);
  const searchActive = searchQuery.trim().length > 0;
  const focusedPark = focusedParkCode
    ? groups.find((g) => g.parkCode.toLowerCase() === focusedParkCode)
    : undefined;
  const selectedPark = selectedId
    ? groups.find((g) => g.trails.some((t) => t.id === selectedId))
    : undefined;
  const manualPark = manualOpenPark
    ? groups.find((g) => g.parkName === manualOpenPark)
    : undefined;
  const openPark = focusedPark?.parkName ?? selectedPark?.parkName ?? manualPark?.parkName ?? null;
  const rows = buildRows(groups, openPark, searchActive);

  // TanStack Virtual manages mutable measurement functions internally.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? HEADER_HEIGHT : TRAIL_HEIGHT),
    overscan: 5,
  });

  function handleToggle(group: ParkGroup) {
    if (searchActive) return;
    const willOpen = openPark !== group.parkName;
    setManualOpenPark(willOpen ? group.parkName : null);
  }

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
                  open={searchActive || openPark === row.group.parkName}
                  onOpenChange={() => handleToggle(row.group)}
                >
                  <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-sidebar-accent overflow-hidden">
                    <CaretRightIcon
                      className="size-3 shrink-0 text-muted-foreground transition-transform"
                      style={{
                        transform: searchActive || openPark === row.group.parkName ? "rotate(90deg)" : undefined,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium overflow-hidden">
                      <HighlightedText text={row.group.parkName} query={searchQuery} />
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
                    showLocation={groupMode === "state" || (searchActive && row.trail.location.toLowerCase().includes(searchQuery.trim().toLowerCase()))}
                    searchQuery={searchQuery}
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
