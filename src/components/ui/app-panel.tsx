"use client"

import * as React from "react"
import { use } from "react"
import { SidebarSimpleIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type PanelContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const PanelContext = React.createContext<PanelContextValue | null>(null)

function usePanel() {
  const ctx = use(PanelContext)
  if (!ctx) throw new Error("usePanel must be used inside AppPanelProvider")
  return ctx
}

function AppPanelProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <PanelContext value={{ open, setOpen }}>
      {children}
    </PanelContext>
  )
}

const PANEL_WIDTH = "22rem"

function AppPanel({
  className,
  children,
  ...props
}: React.ComponentProps<"aside">) {
  const { open, setOpen } = usePanel()

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "md:hidden fixed inset-0 z-10 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        data-slot="app-panel"
        data-state={open ? "open" : "closed"}
        style={{ width: PANEL_WIDTH } as React.CSSProperties}
        className={cn(
          "bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-20 flex flex-col border-r border-sidebar-border transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

function AppPanelTrigger({
  className,
  variant = "ghost",
  size = "icon-sm",
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = usePanel()

  return (
    <Button
      data-slot="app-panel-trigger"
      variant={variant}
      size={size}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        setOpen((v) => !v)
      }}
      aria-label="Toggle navigation panel"
      {...props}
    >
      {children ?? <SidebarSimpleIcon />}
    </Button>
  )
}

function AppPanelInset({
  className,
  ...props
}: React.ComponentProps<"main">) {
  const { open } = usePanel()

  return (
    <main
      data-slot="app-panel-inset"
      style={{ "--panel-width": PANEL_WIDTH } as React.CSSProperties}
      className={cn(
        "relative flex w-full flex-1 flex-col transition-[margin-left] duration-200 ease-in-out",
        open ? "md:ml-[var(--panel-width)]" : "md:ml-0",
        className
      )}
      {...props}
    />
  )
}

export { AppPanelProvider, AppPanel, AppPanelTrigger, AppPanelInset, usePanel }
