"use client";

import { Suspense } from "react";
import { AppPanel, AppPanelInset, AppPanelProvider } from "@/components/ui/app-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { MapShell } from "@/components/map-shell";
import { Spinner } from "@/components/ui/spinner";
import type { Trail } from "@/lib/types";

function SidebarFallback() {
  return (
    <AppPanel>
      <div className="grid h-full place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    </AppPanel>
  );
}

export function MainApp({
  trails,
  boundaries,
}: {
  trails: Trail[];
  boundaries: GeoJSON.FeatureCollection;
}) {
  return (
    <AppPanelProvider defaultOpen={true}>
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar trails={trails} />
      </Suspense>
      <AppPanelInset className="h-svh overflow-hidden">
        <MapShell trails={trails} boundaries={boundaries} />
      </AppPanelInset>
    </AppPanelProvider>
  );
}
