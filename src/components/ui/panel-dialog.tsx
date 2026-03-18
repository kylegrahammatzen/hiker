"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PanelDialogProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  triggerLabel?: string;
  contentClassName?: string;
  popupClassName?: string;
};

export const PanelDialog = (props: PanelDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {props.triggerLabel ?? "View more"}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
          <DialogPrimitive.Popup
            className={cn(
              "relative w-full max-w-sm overflow-hidden rounded-xl border bg-background shadow-xl transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95",
              props.popupClassName,
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <DialogPrimitive.Title className="text-sm font-semibold">{props.title}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close"
                render={<Button size="icon" variant="ghost" className="rounded-full" />}
              >
                <XIcon />
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description className="sr-only">
              {props.description}
            </DialogPrimitive.Description>

            <div className={cn("max-h-[calc(70vh-3.25rem)] overflow-y-auto p-4", props.contentClassName)}>
              {props.children}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
