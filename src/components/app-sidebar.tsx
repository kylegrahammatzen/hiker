"use client";

import { useState } from "react";
import { MountainsIcon, MagnifyingGlassIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrailList } from "@/components/trail-list";
import { TrailDetail } from "@/components/trail-detail";
import { useSelectedTrailId, useMapLoaded, trailActions } from "@/lib/store";
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
  return Array.from(map, ([parkName, { parkCode, trails }]) => ({ parkName, parkCode, trails }));
}

export function AppSidebar({ trails }: { trails?: Trail[] }) {
  const [search, setSearch] = useState("");
  const allTrails = trails ?? [];
  const selectedId = useSelectedTrailId();
  const mapLoaded = useMapLoaded();

  const selectedTrail = allTrails.find((t) => t.id === selectedId);

  const q = search.toLowerCase();

  const filtered = allTrails.filter((t) => {
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.parkName.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q);
    return matchesSearch;
  });

  const groups = groupByPark(filtered);

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="offcanvas"
      className="border-r"
    >
      <SidebarHeader className="gap-4 p-4">
        <div className="flex items-center gap-2">
          {selectedTrail ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => trailActions.setSelectedTrailId(null)}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <span className="text-sm font-medium truncate">Back to trails</span>
            </>
          ) : (
            <>
              <MountainsIcon className="size-5 text-primary" />
              <span className="text-lg font-semibold tracking-tight">hiker</span>
            </>
          )}
        </div>
        {!selectedTrail && (
          <InputGroup>
            <InputGroupInput
              aria-label="Search trails"
              placeholder="Search trails..."
              type="search"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
            <InputGroupAddon>
              <MagnifyingGlassIcon aria-hidden="true" />
            </InputGroupAddon>
          </InputGroup>
        )}
      </SidebarHeader>
      <SidebarContent>
        {selectedTrail ? (
          <TrailDetail
            trail={selectedTrail}
            nearbyTrails={allTrails.filter(
              (t) => t.parkName === selectedTrail.parkName && t.id !== selectedTrail.id
            )}
          />
        ) : mapLoaded ? (
          <SidebarGroup>
            <SidebarGroupLabel>
              {filtered.length} trails in {groups.length} {groups.length === 1 ? "park" : "parks"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <TrailList groups={groups} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
