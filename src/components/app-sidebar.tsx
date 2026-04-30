"use client";

import { useRef, useEffect, useDeferredValue } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { MountainsIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppPanel } from "@/components/ui/app-panel";
import { Tabs, TabsList, TabsIndicator, TabsTrigger } from "@/components/ui/tabs";
import { TrailList } from "@/components/trail-list";
import { TrailDetail } from "@/components/trail-detail";
import { Spinner } from "@/components/ui/spinner";
import {
  useSelectedTrailId,
  useMapLoaded,
  useTrailActions,
  useVisibleTrailIds,
  useGroupMode,
  useMapStyle,
  useFocusedParkCode,
} from "@/lib/trail-context";
import type { MapStyle } from "@/lib/trail-context";
import { groupTrails, computeDisplayGroups, type GroupMode } from "@/lib/trail-grouping";
import type { Trail } from "@/lib/types";

export function AppSidebar({ trails = [], initialParkCode }: { trails?: Trail[]; initialParkCode?: string | null }) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const deferredSearch = useDeferredValue(search);
  const selectedId = useSelectedTrailId();
  const mapLoaded = useMapLoaded();
  const actions = useTrailActions();
  const visibleTrailIds = useVisibleTrailIds();
  const groupMode = useGroupMode();
  const mapStyle = useMapStyle();
  const focusedParkCode = useFocusedParkCode();
  const focusedParkCodeKey = focusedParkCode?.toLowerCase() ?? (!mapLoaded ? initialParkCode?.toLowerCase() ?? null : null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusedParkCodeKey || !search) return;
    void setSearch(null);
  }, [focusedParkCodeKey, search, setSearch]);

  // Scroll to top when selected trail changes
  useEffect(() => {
    if (selectedId && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [selectedId]);

  const displaySearch = focusedParkCodeKey ? "" : deferredSearch;
  const q = displaySearch.trim().toLowerCase();
  const visibleSet = new Set(visibleTrailIds);

  const filtered = trails.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.parkName.toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q),
  );

  function handleSearchChange(value: string) {
    if (focusedParkCodeKey) actions.setFocusedParkCode(null);
    void setSearch(value || null);
  }

  // A park selected from the map should always drive the sidebar, even before
  // the viewport-visible trail list catches up after the map flyTo animation.
  const displayTrails = focusedParkCodeKey
    ? filtered.filter((t) => t.parkCode.toLowerCase() === focusedParkCodeKey)
    : visibleSet.size > 0
      ? filtered.filter((t) => visibleSet.has(t.id))
      : filtered;

  const effectiveGroupMode = focusedParkCodeKey ? "park" : groupMode;
  const { allGroups, uniqueParkCount } = computeDisplayGroups(groupTrails(displayTrails, effectiveGroupMode));
  const selectedTrailById = trails.find((t) => t.id === selectedId);
  const focusedParkDetailTrail = focusedParkCodeKey
    ? displayTrails.find((t) => t.id === `${focusedParkCodeKey}-park-hiking`) ??
      (displayTrails.length === 1 ? displayTrails[0] : null)
    : null;
  const selectedTrail = selectedTrailById ?? focusedParkDetailTrail;

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
                handleSearchChange(e.target.value)
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
                  t.parkCode.toLowerCase() === selectedTrail.parkCode.toLowerCase() &&
                  t.id !== selectedTrail.id,
              )}
            />
          </ScrollArea>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 shrink-0">
              <p className="text-xs text-muted-foreground">
                {displayTrails.length} {displayTrails.length === 1 ? "trail" : "trails"} in{" "}
                {uniqueParkCount} {effectiveGroupMode === "state" ? (uniqueParkCount === 1 ? "state" : "states") : (uniqueParkCount === 1 ? "park" : "parks")}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <Tabs
                  value={mapStyle}
                  onValueChange={(value) => actions.setMapStyle(value as MapStyle)}
                >
                  <TabsList>
                    <TabsTrigger value="standard">Standard</TabsTrigger>
                    <TabsTrigger value="satellite">Satellite</TabsTrigger>
                    <TabsIndicator />
                  </TabsList>
                </Tabs>
                <Tabs
                  value={effectiveGroupMode}
                  onValueChange={(value) => actions.setGroupMode(value as GroupMode)}
                >
                  <TabsList>
                    <TabsTrigger value="state">State</TabsTrigger>
                    <TabsTrigger value="park">Park</TabsTrigger>
                    <TabsIndicator />
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {mapLoaded ? (
                <TrailList
                  groups={allGroups}
                  groupMode={effectiveGroupMode}
                  focusedParkCode={focusedParkCodeKey}
                  searchQuery={displaySearch}
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <Spinner className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppPanel>
  );
}
