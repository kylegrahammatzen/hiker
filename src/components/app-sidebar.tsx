"use client";

import { useState } from "react";
import { MountainsIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppPanel } from "@/components/ui/app-panel";
import { TrailList } from "@/components/trail-list";
import { TrailDetail } from "@/components/trail-detail";
import { Spinner } from "@/components/ui/spinner";
import {
  useSelectedTrailId,
  useMapLoaded,
  useTrailActions,
  useVisibleTrailIds,
  useFocusedParkCode,
  useIsLoadingPark,
} from "@/lib/trail-context";
import { groupByPark, computeDisplayGroups } from "@/lib/trail-grouping";
import type { Trail } from "@/lib/types";

export function AppSidebar({ trails = [] }: { trails?: Trail[] }) {
  const [search, setSearch] = useState("");
  const selectedId = useSelectedTrailId();
  const mapLoaded = useMapLoaded();
  const actions = useTrailActions();
  const visibleTrailIds = useVisibleTrailIds();
  const focusedParkCode = useFocusedParkCode();
  const isLoadingPark = useIsLoadingPark();

  const selectedTrail = trails.find((t) => t.id === selectedId);
  const q = search.toLowerCase();
  const visibleSet = new Set(visibleTrailIds);

  const filtered = trails.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.parkName.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q),
  );

  // When focused on a park, show all trails in that park
  // Otherwise, show only trails visible in the current viewport
  const displayTrails = focusedParkCode
    ? filtered.filter((t) => t.parkCode === focusedParkCode)
    : visibleSet.size > 0
      ? filtered.filter((t) => visibleSet.has(t.id))
      : filtered;

  const { allGroups, uniqueParkCount } = computeDisplayGroups(groupByPark(displayTrails));

  const handleBack = () => {
    setSearch("");
    actions.setLoadingPark(false);
    actions.setFocusedParkCode(null);
  };

  return (
    <AppPanel>
      <div className="flex flex-col gap-2 px-2 pt-2 pb-2 shrink-0">
        {/* Header - logo first, then optional back button */}
        <div className="flex h-8 items-center gap-2">
          <MountainsIcon className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight flex-1">
            hiker
          </span>
          {(selectedTrail || focusedParkCode) && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (selectedTrail) {
                  actions.setSelectedTrailId(null);
                } else {
                  handleBack();
                }
              }}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}
        </div>
        {/* Search bar - only show when not viewing a trail detail */}
        {!selectedTrail && (
          <InputGroup>
            <InputGroupInput
              aria-label="Search trails"
              placeholder="Search trails..."
              type="search"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
            />
          </InputGroup>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {selectedTrail ? (
          <ScrollArea className="flex-1 min-h-0">
            <TrailDetail
              trail={selectedTrail}
              nearbyTrails={trails.filter(
                (t) =>
                  t.parkName === selectedTrail.parkName &&
                  t.id !== selectedTrail.id,
              )}
            />
          </ScrollArea>
        ) : isLoadingPark ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : mapLoaded ? (
          <>
            <p className="px-2 py-1.5 text-xs text-muted-foreground shrink-0">
              {displayTrails.length} {displayTrails.length === 1 ? "trail" : "trails"} in{" "}
              {uniqueParkCount} {uniqueParkCount === 1 ? "park" : "parks"}
            </p>
            <div className="flex-1 min-h-0">
              <TrailList
                key={focusedParkCode ?? "all"}
                groups={allGroups}
                hideVisibleFilter={focusedParkCode === null}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
      </div>
    </AppPanel>
  );
}
