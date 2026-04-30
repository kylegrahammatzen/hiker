"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

const Tabs = BaseTabs.Root;

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof BaseTabs.List>
>(({ className, ...props }, ref) => (
  <BaseTabs.List
    ref={ref}
    className={cn(
      "relative flex gap-0.5 rounded-md bg-muted p-0.5",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsIndicator = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<typeof BaseTabs.Indicator>
>(({ className, ...props }, ref) => (
  <BaseTabs.Indicator
    ref={ref}
    className={cn(
      "absolute top-0.5 bottom-0.5 left-[var(--active-tab-left)] w-[var(--active-tab-width)] rounded bg-background shadow-sm transition-[left,width] duration-180 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
));
TabsIndicator.displayName = "TabsIndicator";

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof BaseTabs.Tab>
>(({ className, ...props }, ref) => (
  <BaseTabs.Tab
    ref={ref}
    className={cn(
      "relative z-10 cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors duration-150 ease-out select-none motion-reduce:transition-none",
      "data-[selected]:text-foreground",
      "hover:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsPanel = BaseTabs.Panel;

export { Tabs, TabsList, TabsIndicator, TabsTrigger, TabsPanel };
