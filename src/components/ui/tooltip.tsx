"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = BaseTooltip.Provider;

const Tooltip = BaseTooltip.Root;

const TooltipTrigger = BaseTooltip.Trigger;

const TooltipPortal = BaseTooltip.Portal;

const TooltipPositioner = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof BaseTooltip.Positioner>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <BaseTooltip.Positioner
    ref={ref}
    sideOffset={sideOffset}
    className={cn("outline-none", className)}
    {...props}
  />
));
TooltipPositioner.displayName = "TooltipPositioner";

const TooltipPopup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof BaseTooltip.Popup>
>(({ className, ...props }, ref) => (
  <BaseTooltip.Popup
    ref={ref}
    className={cn(
      "rounded-md bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md",
      "border border-border/50",
      "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
      "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
      "transition-[transform,opacity] duration-150",
      "@media(prefers-reduced-motion:reduce){transition-duration:0ms}",
      className,
    )}
    {...props}
  />
));
TooltipPopup.displayName = "TooltipPopup";

function TooltipContent({
  children,
  side = "bottom",
  sideOffset = 6,
  className,
  ...props
}: {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
} & Omit<React.ComponentProps<typeof BaseTooltip.Popup>, "children">) {
  return (
    <TooltipPortal>
      <TooltipPositioner side={side} sideOffset={sideOffset}>
        <TooltipPopup className={className} {...props}>
          {children}
        </TooltipPopup>
      </TooltipPositioner>
    </TooltipPortal>
  );
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
  TooltipContent,
};
