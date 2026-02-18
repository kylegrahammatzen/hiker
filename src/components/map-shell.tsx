"use client";

import { useRef, useState, useEffect } from "react";
import { PlusIcon, MinusIcon, CompassIcon, SunIcon, MoonIcon, XIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import type { Trail } from "@/lib/types";
import { AppPanelTrigger, usePanel } from "@/components/ui/app-panel";
import { Button } from "@/components/ui/button";
import { useTrailActions } from "@/lib/trail-context";
import MapView from "@/components/map-view";
import type { MapViewHandle } from "@/components/map-view";

export function MapShell({ trails, initialParkCode }: { trails: Trail[]; initialParkCode: string | null }) {
  const mapViewRef = useRef<MapViewHandle>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const { open: panelOpen } = usePanel();
  const actions = useTrailActions();
  const [mounted, setMounted] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [isAtDefault, setIsAtDefault] = useState(true);

  useEffect(() => { setMounted(true) }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const b = mapViewRef.current?.getBearing() ?? 0;
      setBearing((prev) => (Math.abs(prev - b) > 0.5 ? b : prev));
      setIsAtDefault(mapViewRef.current?.isAtDefaultView() ?? true);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => mapViewRef.current?.resize(), 210);
    return () => clearTimeout(t);
  }, [panelOpen]);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <AppPanelTrigger variant="map" size="icon-sm" />
          {!isAtDefault && (
            <Button
              variant="map"
              size="sm"
              onClick={actions.resetView}
              title="Reset view"
              aria-label="Reset view"
            >
              <XIcon />
              Reset
            </Button>
          )}
        </div>
        <Button variant="map" size="icon-sm" onClick={() => mapViewRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in">
          <PlusIcon />
        </Button>
        <Button variant="map" size="icon-sm" onClick={() => mapViewRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out">
          <MinusIcon />
        </Button>
        {bearing !== 0 && (
          <Button variant="map" size="icon-sm" onClick={() => mapViewRef.current?.resetNorth()} title="Reset north" aria-label="Reset north">
            <CompassIcon style={{ transform: `rotate(${-bearing}deg)` }} />
          </Button>
        )}
        <Button
          variant="map"
          size="icon-sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
          aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
        >
          {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
        </Button>
      </div>
      <MapView
        ref={mapViewRef}
        trails={trails}
        theme={mounted ? resolvedTheme : undefined}
        initialParkCode={initialParkCode}
      />
    </div>
  );
}
