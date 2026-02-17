"use client";

import type { Trail } from "@/lib/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTrailStore } from "@/lib/store";
import MapView from "@/components/map-view";

export function MapShell({ trails }: { trails: Trail[] }) {
  const resetView = useTrailStore((s) => s.resetView);
  const selectedId = useTrailStore((s) => s.selectedTrailId);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <SidebarTrigger className="bg-background/80 backdrop-blur-sm shadow-md size-8" />
        {selectedId && (
          <Button
            variant="destructive"
            size="sm"
            onClick={resetView}
            className="h-8 bg-destructive/90 backdrop-blur-sm shadow-md"
          >
            Reset Hike
          </Button>
        )}
      </div>
      <MapView trails={trails} />
    </div>
  );
}
