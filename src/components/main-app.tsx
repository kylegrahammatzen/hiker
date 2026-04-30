"use client";

import { AppPanelInset, AppPanelProvider } from "@/components/ui/app-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { MapShell } from "@/components/map-shell";
import type { Trail } from "@/lib/types";

export function MainApp({
  trails,
  boundaries,
  initialParkCode,
}: {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
  initialParkCode: string | null;
}) {
  return (
    <AppPanelProvider defaultOpen={true}>
      <AppSidebar trails={trails} initialParkCode={initialParkCode} />
      <AppPanelInset className="h-svh overflow-hidden">
        <MapShell trails={trails} boundaries={boundaries} initialParkCode={initialParkCode} />
      </AppPanelInset>
    </AppPanelProvider>
  );
}
