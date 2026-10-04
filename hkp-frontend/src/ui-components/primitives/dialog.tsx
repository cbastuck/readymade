import React, { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "hkp-frontend/src/ui-components";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-white/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * How a DialogDescription tells the content around it that it is there.
 *
 * Radix points the content's `aria-describedby` at a description whether or not
 * one is rendered, and warns about the reference that dangles when none is. A
 * dialog without a description is described by nothing — its title already
 * names it — so the content keeps the reference only while a description is
 * mounted.
 *
 * Both ends of that reference belong to Radix: its check looks for the id it
 * generated, so a description given an id by hand counts as missing however
 * carefully the content is pointed at it. Neither `aria-describedby` nor a
 * description's `id` is therefore something a caller can pass.
 */
const DescriptionPresenceContext = React.createContext<
  (() => () => void) | null
>(null);

type DialogContentProps = typeof DialogPrimitive.Content;

const DialogContent = React.forwardRef<
  React.ElementRef<DialogContentProps>,
  Omit<
    React.ComponentPropsWithoutRef<DialogContentProps>,
    "aria-describedby"
  > & {
    additionalHeaderButtons?: Array<ReactNode>;
    /**
     * Where the dialog is portalled to, for a caller that has covered the
     * window: a view drawn over the app is its own stacking context, and a
     * dialog left on the body would open underneath the thing that opened it.
     * The body, as Radix has it, when nothing says otherwise.
     */
    container?: HTMLElement | null;
  }
>(
  (
    {
      className,
      children,
      additionalHeaderButtons,
      onInteractOutside,
      container,
      ...props
    },
    ref,
  ) => {
    const [descriptions, setDescriptions] = React.useState(0);
    const announceDescription = React.useCallback(() => {
      setDescriptions((count) => count + 1);
      return () => setDescriptions((count) => count - 1);
    }, []);

    return (
      <DialogPortal container={container ?? undefined}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          {...(descriptions > 0 ? {} : { "aria-describedby": undefined })}
          onInteractOutside={(event) => {
            // Notifications stay above the dialog and stay clickable there (see
            // `sonner.tsx`); dismissing one is not an answer to what the dialog is
            // asking, so it must not close it.
            const target = event.target as Element | null;
            if (target?.closest?.("[data-sonner-toaster]")) {
              event.preventDefault();
            }
            onInteractOutside?.(event);
          }}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
            className,
          )}
          {...props}
        >
          <DescriptionPresenceContext.Provider value={announceDescription}>
            {children}
          </DescriptionPresenceContext.Provider>
          <div className="absolute right-4 top-4 flex">
            {additionalHeaderButtons?.map((b, idx) => (
              <div key={`additional-dialog-button-${idx}`}>{b}</div>
            ))}
            <DialogPrimitive.Close
              aria-label="close-dialog-button"
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>, "id">
>(({ className, ...props }, ref) => {
  const announce = React.useContext(DescriptionPresenceContext);
  // A layout effect, so the reference is in place before the dialog is shown.
  React.useLayoutEffect(() => announce?.(), [announce]);

  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
