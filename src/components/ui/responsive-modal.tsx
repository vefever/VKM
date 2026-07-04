import * as React from "react";
import { useAppShell } from "@/hooks/use-app-shell";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

// One modal, two faces: a native-style bottom sheet (vaul drawer with drag
// handle) on the mobile app shell, a centered Radix dialog on desktop. The API
// mirrors Dialog's so migrating a call site is an import + tag rename.
// Consolidates the responsive pattern previously hand-rolled in kpi-tile.tsx
// and update-snapshot-drawer.tsx.

const MobileCtx = React.createContext(false);

function ResponsiveModal(props: React.ComponentProps<typeof Dialog>) {
  const { appShell } = useAppShell();
  return (
    <MobileCtx.Provider value={appShell}>
      {appShell ? <Drawer {...props} /> : <Dialog {...props} />}
    </MobileCtx.Provider>
  );
}

function ResponsiveModalTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveModalClose(props: React.ComponentProps<typeof DialogClose>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

function ResponsiveModalContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const mobile = React.useContext(MobileCtx);
  if (mobile) {
    return (
      <DrawerContent className="max-h-[92dvh]">
        {/* Scrollable body so tall forms never push the sheet off-screen; the
            drag handle stays pinned above. Bottom padding clears the home
            indicator. */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+1.25rem)] pt-2",
            className,
          )}
          data-selectable
        >
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? (
    <DrawerHeader className={cn("px-0 pt-1 text-left", className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

function ResponsiveModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? (
    <DrawerFooter className={cn("px-0 pb-0", className)} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

function ResponsiveModalTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveModalDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const mobile = React.useContext(MobileCtx);
  return mobile ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
};
