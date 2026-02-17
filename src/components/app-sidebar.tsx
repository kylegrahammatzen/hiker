"use client";

import { useState } from "react";
import { Mountain, Search, ArrowLeft } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { TrailList } from "@/components/trail-list";
import { TrailDetail } from "@/components/trail-detail";
import { useTrailStore } from "@/lib/store";
import type { Trail } from "@/lib/types";

type ParkGroup = {
  parkName: string;
  trails: Trail[];
};

function groupByPark(trails: Trail[]): ParkGroup[] {
  const map = new Map<string, Trail[]>();
  for (const t of trails) {
    const list = map.get(t.parkName);
    if (list) list.push(t);
    else map.set(t.parkName, [t]);
  }
  return Array.from(map, ([parkName, trails]) => ({ parkName, trails }));
}

export function AppSidebar({ trails }: { trails?: Trail[] }) {
  const [search, setSearch] = useState("");
  const allTrails = trails ?? [];
  const selectedId = useTrailStore((s) => s.selectedTrailId);
  const setSelected = useTrailStore((s) => s.setSelectedTrailId);
  const visibleTrailIds = useTrailStore((s) => s.visibleTrailIds);

  const selectedTrail = allTrails.find((t) => t.id === selectedId);

  const visibleSet = new Set(visibleTrailIds);
  const q = search.toLowerCase();

  const filtered = allTrails.filter((t) => {
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.parkName.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q);
    const matchesViewport = visibleSet.size === 0 || visibleSet.has(t.id);
    return matchesSearch && matchesViewport;
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
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium truncate">Back to trails</span>
            </>
          ) : (
            <>
              <Mountain className="size-4 text-primary" />
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
              <Search aria-hidden="true" />
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
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>
              {filtered.length} trails in {groups.length} {groups.length === 1 ? "park" : "parks"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <TrailList groups={groups} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
