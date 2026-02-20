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
import type { Trail } from "@/lib/types";

type ParkGroup = {
  parkName: string;
  parkCode: string;
  trails: Trail[];
};

function groupByPark(trails: Trail[]): ParkGroup[] {
  const map = new Map<string, { parkCode: string; trails: Trail[] }>();
  for (const t of trails) {
    const existing = map.get(t.parkName);
    if (existing) existing.trails.push(t);
    else map.set(t.parkName, { parkCode: t.parkCode, trails: [t] });
  }
  return Array.from(map, ([parkName, { parkCode, trails }]) => ({
    parkName,
    parkCode,
    trails,
  }));
}

export function AppSidebar({ trails }: { trails?: Trail[] }) {
  const [search, setSearch] = useState("");
  const allTrails = trails ?? [];
  const selectedId = useSelectedTrailId();
  const mapLoaded = useMapLoaded();
  const actions = useTrailActions();
  const visibleTrailIds = useVisibleTrailIds();
  const focusedParkCode = useFocusedParkCode();
  const isLoadingPark = useIsLoadingPark();

  const selectedTrail = allTrails.find((t) => t.id === selectedId);

  const q = search.toLowerCase();
  const filtered = allTrails.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.parkName.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q),
  );

  const visibleSet = new Set(visibleTrailIds);
  const visibleFiltered = filtered.filter((t) => visibleSet.has(t.id));
  const displayTrails = focusedParkCode !== null ? visibleFiltered : filtered;
  const displayGroups = groupByPark(displayTrails);

  const showBackButton = search.length > 0 || focusedParkCode !== null;

  const handleBack = () => {
    setSearch("");
    actions.setLoadingPark(false);
    actions.setFocusedParkCode(null);
  };

  return (
    <AppPanel>
      <div className="flex flex-col gap-3 px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          {selectedTrail ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => actions.setSelectedTrailId(null)}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <span className="text-sm font-medium truncate">
                Back to trails
              </span>
            </>
          ) : (
            <>
              <MountainsIcon className="size-5 text-primary" />
              <span className="text-lg font-semibold tracking-tight">
                hiker
              </span>
            </>
          )}
        </div>
        {!selectedTrail && (
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Go back"
                onClick={handleBack}
                className="shrink-0"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
            )}
            <InputGroup className="flex-1">
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
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {selectedTrail ? (
          <ScrollArea className="flex-1 min-h-0">
            <TrailDetail
              trail={selectedTrail}
              nearbyTrails={allTrails.filter(
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
            <p className="px-5 py-1.5 text-xs text-muted-foreground shrink-0">
              {displayTrails.length} trails in {displayGroups.length}{" "}
              {displayGroups.length === 1 ? "park" : "parks"}
            </p>
            <div className="flex-1 min-h-0">
              <TrailList
                key={focusedParkCode ?? "all"}
                groups={displayGroups}
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
