"use client"

import * as React from "react"
import { use } from "react"
import { SidebarSimpleIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetPopup } from "@/components/ui/sheet"

type PanelContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobile: boolean
}

const PanelContext = React.createContext<PanelContextValue | null>(null)

const FALLBACK_PANEL_CONTEXT: PanelContextValue = {
  open: true,
  setOpen: () => undefined,
  isMobile: false,
}

function usePanel() {
  const ctx = use(PanelContext)
  return ctx ?? FALLBACK_PANEL_CONTEXT
}

function AppPanelProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    setIsMobile(mql.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

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
    <PanelContext value={{ open, setOpen, isMobile }}>
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
  const { open, setOpen, isMobile } = usePanel()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup 
          side="left" 
          showCloseButton={false}
          className="w-[85vw] max-w-sm p-0"
        >
          <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
            {children}
          </div>
        </SheetPopup>
      </Sheet>
    )
  }

  return (
    <aside
      data-slot="app-panel"
      data-state={open ? "open" : "closed"}
      style={{ width: PANEL_WIDTH } as React.CSSProperties}
      className={cn(
        "bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-20 flex flex-col border-r border-sidebar-border transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
        open ? "translate-x-0" : "-translate-x-full",
        className
      )}
      {...props}
    >
      {children}
    </aside>
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
        "relative flex w-full flex-1 flex-col",
        open ? "md:ml-[var(--panel-width)]" : "md:ml-0",
        className
      )}
      {...props}
    />
  )
}

export { AppPanelProvider, AppPanel, AppPanelTrigger, AppPanelInset, usePanel }
