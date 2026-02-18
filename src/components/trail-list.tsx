"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "motion/react";
import { MagnifyingGlassMinusIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { Trail } from "@/lib/types";
import { TrailCard } from "@/components/trail-card";
import { useSelectedTrailId, useVisibleTrailIds, useTrailActions, useFocusedParkCode } from "@/lib/trail-context";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

type ParkGroup = {
  parkName: string;
  parkCode: string;
  trails: Trail[];
};

type Row =
  | { kind: "header"; group: ParkGroup }
  | { kind: "trail"; trail: Trail; showLocation: boolean };

const DIFFICULTY_ORDER = { easy: 0, moderate: 1, hard: 2 };

function sortTrails(trails: Trail[]) {
  return [...trails].sort((a, b) => {
    const diff = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (diff !== 0) return diff;
    return (parseFloat(a.length) || 0) - (parseFloat(b.length) || 0);
  });
}

function buildRows(groups: ParkGroup[], openPark: string | null, visibleIds: Set<string>): Row[] {
  const sorted = [...groups].sort((a, b) => b.trails.length - a.trails.length);
  const multiGroups = sorted.filter((g) => g.trails.length > 1);
  const singles = sorted.filter((g) => g.trails.length === 1);
  const onlySingles = multiGroups.length === 0;

  const singlesGroup: ParkGroup | null =
    !onlySingles && singles.length > 0
      ? { parkName: "Other Parks", parkCode: "other", trails: singles.map((g) => g.trails[0]!) }
      : null;

  const uniqueParksVisible = new Set(
    groups.flatMap((g) => g.trails.filter((t) => visibleIds.has(t.id))).map((t) => t.parkCode)
  );
  const totalVisible = groups.reduce(
    (n, g) => n + g.trails.filter((t) => visibleIds.has(t.id)).length,
    0
  );
  const useFlat = visibleIds.size > 0 && (totalVisible <= 20 || uniqueParksVisible.size === 1);

  if (useFlat) {
    const flatTrails = groups
      .flatMap((g) => g.trails)
      .filter((t) => visibleIds.has(t.id));
    flatTrails.sort((a, b) => {
      const diff = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
      if (diff !== 0) return diff;
      return (parseFloat(a.length) || 0) - (parseFloat(b.length) || 0);
    });
    return flatTrails.map((trail) => ({
      kind: "trail",
      trail,
      showLocation: uniqueParksVisible.size > 1,
    }));
  }

  const rows: Row[] = [];
  const allGroupsToRender = singlesGroup
    ? [...multiGroups, singlesGroup]
    : onlySingles
    ? sorted
    : multiGroups;

  for (const group of allGroupsToRender) {
    rows.push({ kind: "header", group });
    if (openPark === group.parkName) {
      for (const trail of sortTrails(group.trails)) {
        rows.push({ kind: "trail", trail, showLocation: false });
      }
    }
  }

  return rows;
}

const HEADER_HEIGHT = 40;
const TRAIL_HEIGHT = 72;

export function TrailList({ groups, hideVisibleFilter = false }: { groups: ParkGroup[]; hideVisibleFilter?: boolean }) {
  const selectedId = useSelectedTrailId();
  const visibleTrailIds = useVisibleTrailIds();
  const focusedParkCode = useFocusedParkCode();
  const actions = useTrailActions();
  const viewportRef = useRef<HTMLDivElement>(null);

  const sorted = [...groups].sort((a, b) => b.trails.length - a.trails.length);
  const multiGroups = sorted.filter((g) => g.trails.length > 1);
  const singles = sorted.filter((g) => g.trails.length === 1);
  const onlySingles = multiGroups.length === 0;
  const singlesGroup: ParkGroup | null =
    !onlySingles && singles.length > 0
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

  const groupNames = sorted.map((g) => g.parkName).join(",");
  useEffect(() => {
    setOpenPark((prev) => {
      if (!prev) return null;
      if (prev === "Other Parks" && singlesGroup) return prev;
      if (!sorted.some((g) => g.parkName === prev)) return null;
      return prev;
    });
  }, [groupNames]);

  useEffect(() => {
    if (!selectedId) return;
    const park = multiGroups.find((g) => g.trails.some((t) => t.id === selectedId));
    if (park) { setOpenPark(park.parkName); return; }
    if (singlesGroup?.trails.some((t) => t.id === selectedId)) setOpenPark("Other Parks");
  }, [selectedId]);

  useEffect(() => {
    if (!focusedParkCode) {
      setOpenPark(null);
      return;
    }
    const allGroups = [...multiGroups, ...singles];
    const park = allGroups.find((g) => g.parkCode === focusedParkCode);
    if (park) setOpenPark(park.parkName);
  }, [focusedParkCode, groupNames]);

  const visibleSet = hideVisibleFilter ? new Set<string>() : new Set(visibleTrailIds);
  const rows = buildRows(groups, openPark, visibleSet);

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
      if (willOpen && group.parkCode !== "other") {
        actions.setLoadingPark(true);
        actions.setFocusedParkCode(group.parkCode);
      } else {
        actions.setFocusedParkCode(null);
      }
    },
    [openPark, actions]
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
      <div className="overflow-hidden" style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
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
              ) : row.showLocation ? (
                <div className="px-3 py-0.5">
                  <TrailCard
                    trail={row.trail}
                    isSelected={selectedId === row.trail.id}
                    onSelect={() => actions.setSelectedTrailId(row.trail.id)}
                    showLocation={row.showLocation}
                  />
                </div>
              ) : (
                <div className="relative ml-[11px] flex flex-col gap-1 pl-4 py-0.5">
                  <Separator orientation="vertical" className="absolute left-0 top-0 h-full" />
                  <TrailCard
                    trail={row.trail}
                    isSelected={selectedId === row.trail.id}
                    onSelect={() => actions.setSelectedTrailId(row.trail.id)}
                    showLocation={row.showLocation}
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
