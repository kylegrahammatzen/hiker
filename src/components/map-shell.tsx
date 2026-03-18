"use client";

import { useRef, useEffect } from "react";
import { PlusIcon, MinusIcon, SunIcon, MoonIcon, XIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import type { Trail } from "@/lib/types";
import { AppPanelTrigger, usePanel } from "@/components/ui/app-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTrailActions, useMapView, useSelectedTrailId, useFocusedParkCode } from "@/lib/trail-context";
import MapView from "@/components/map-view";
import type { MapViewHandle } from "@/components/map-view";
import { useHasMounted } from "@/hooks/use-has-mounted";

function CompassRose({ bearing, onClick }: { bearing: number; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            aria-label="Reset north"
            className="size-12 cursor-pointer select-none"
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
        }
      >
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-md">
          <polygon points="50,8 42,48 58,48" fill="#dc2626" stroke="white" strokeWidth="1" />
          <polygon points="50,92 42,52 58,52" fill="white" fillOpacity="0.7" stroke="white" strokeWidth="1" />
          <polygon points="92,50 52,42 52,58" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.5" />
          <polygon points="8,50 48,42 48,58" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="4" fill="white" stroke="white" strokeWidth="1" />
          <text x="50" y="7" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui">N</text>
          <text x="50" y="99" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">S</text>
          <text x="97" y="53" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">E</text>
          <text x="3" y="53" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontWeight="600" fontFamily="system-ui">W</text>
        </svg>
      </TooltipTrigger>
      <TooltipContent side="left">Reset north</TooltipContent>
    </Tooltip>
  );
}

export function MapShell({ trails, boundaries, initialParkCode }: { trails: Trail[]; boundaries: GeoJSON.FeatureCollection; initialParkCode: string | null }) {
  const mapViewRef = useRef<MapViewHandle>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const { open: panelOpen } = usePanel();
  const actions = useTrailActions();
  const mapView = useMapView();
  const selectedTrailId = useSelectedTrailId();
  const focusedParkCode = useFocusedParkCode();
  const mounted = useHasMounted();

  useEffect(() => {
    const t = setTimeout(() => mapViewRef.current?.resize(), 210);
    return () => clearTimeout(t);
  }, [panelOpen]);

  const isDark = mounted && resolvedTheme === "dark";
  const showReset = !mapView.isAtDefault || selectedTrailId !== null || focusedParkCode !== null;

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <AppPanelTrigger variant="map" size="icon-sm" />
          {showReset && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="map"
                    size="sm"
                    onClick={actions.resetView}
                    aria-label="Reset view"
                  />
                }
              >
                <XIcon />
                Reset
              </TooltipTrigger>
              <TooltipContent>Reset view</TooltipContent>
            </Tooltip>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="map"
                size="icon-sm"
                onClick={() => mapViewRef.current?.zoomIn()}
                aria-label="Zoom in"
              />
            }
          >
            <PlusIcon />
          </TooltipTrigger>
          <TooltipContent side="right">Zoom in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="map"
                size="icon-sm"
                onClick={() => mapViewRef.current?.zoomOut()}
                aria-label="Zoom out"
              />
            }
          >
            <MinusIcon />
          </TooltipTrigger>
          <TooltipContent side="right">Zoom out</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="map"
                size="icon-sm"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
              />
            }
          >
            {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
          </TooltipTrigger>
          <TooltipContent side="right">
            {mounted ? (isDark ? "Light mode" : "Dark mode") : "Toggle theme"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="absolute top-2 right-2 z-10">
        <CompassRose
          bearing={mapView.bearing}
          onClick={() => mapViewRef.current?.resetNorth()}
        />
      </div>

      <MapView
        ref={mapViewRef}
        trails={trails}
        boundaries={boundaries}
        theme={mounted ? resolvedTheme : undefined}
        initialParkCode={initialParkCode}
      />
    </div>
  );
}
