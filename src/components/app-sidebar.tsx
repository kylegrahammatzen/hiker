"use client";

import { useState, useRef, useEffect } from "react";
import { MountainsIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppPanel } from "@/components/ui/app-panel";
import { Tabs, TabsList, TabsIndicator, TabsTrigger } from "@/components/ui/tabs";
import { TrailList } from "@/components/trail-list";
import { TrailDetail } from "@/components/trail-detail";
import {
  useSelectedTrailId,
  useMapLoaded,
  useTrailActions,
  useVisibleTrailIds,
  useGroupMode,
} from "@/lib/trail-context";
import { groupTrails, computeDisplayGroups, type GroupMode } from "@/lib/trail-grouping";
import type { Trail } from "@/lib/types";

export function AppSidebar({ trails = [] }: { trails?: Trail[] }) {
  const [search, setSearch] = useState("");
  const selectedId = useSelectedTrailId();
  const mapLoaded = useMapLoaded();
  const actions = useTrailActions();
  const visibleTrailIds = useVisibleTrailIds();
  const groupMode = useGroupMode();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top when selected trail changes
  useEffect(() => {
    if (selectedId && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [selectedId]);

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

  // Show trails visible in the current viewport (or all if viewport not ready)
  const displayTrails = visibleSet.size > 0
    ? filtered.filter((t) => visibleSet.has(t.id))
    : filtered;

  const { allGroups, uniqueParkCount } = computeDisplayGroups(groupTrails(displayTrails, groupMode));

  return (
    <AppPanel>
      <div className="flex flex-col gap-2 px-2 pt-2 pb-2 shrink-0">
        {/* Header - logo first, then optional back button */}
        <div className="flex h-8 items-center gap-2">
          <MountainsIcon className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight flex-1">
            hiker
          </span>
          {selectedTrail && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={actions.resetView}
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
          <ScrollArea viewportRef={scrollRef} className="flex-1 min-h-0">
            <TrailDetail
              trail={selectedTrail}
              nearbyTrails={trails.filter(
                (t) =>
                  t.parkName === selectedTrail.parkName &&
                  t.id !== selectedTrail.id,
              )}
            />
          </ScrollArea>
        ) : mapLoaded ? (
          <>
            <div className="flex items-center justify-between px-2 py-1.5 shrink-0">
              <p className="text-xs text-muted-foreground">
                {displayTrails.length} {displayTrails.length === 1 ? "trail" : "trails"} in{" "}
                {uniqueParkCount} {groupMode === "state" ? (uniqueParkCount === 1 ? "state" : "states") : (uniqueParkCount === 1 ? "park" : "parks")}
              </p>
              <Tabs
                defaultValue="state"
                onValueChange={(value) => actions.setGroupMode(value as GroupMode)}
              >
                <TabsList>
                  <TabsTrigger value="state">State</TabsTrigger>
                  <TabsTrigger value="park">Park</TabsTrigger>
                  <TabsIndicator />
                </TabsList>
              </Tabs>
            </div>
            <div className="flex-1 min-h-0">
              <TrailList groups={allGroups} groupMode={groupMode} />
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
