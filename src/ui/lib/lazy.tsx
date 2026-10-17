"use client";

import { cloneElement, lazy, Suspense, useState, type ComponentType } from "react";

/**
 * Overlays on first use (D-179). A sheet, dialog, menu or popover is closed when a page loads, yet its
 * Radix primitives (focus scope, dismissable layer, popper, scroll lock) are most of a console's
 * initial JavaScript. These wrappers render nothing — or just the trigger — until the overlay is first
 * opened, then load the real component and keep it mounted.
 *
 * Chunks are warmed on the first user interaction anywhere on the page (pointer or key), so an
 * overlay usually opens without a network wait, the staff PWA's service worker caches the chunks for
 * offline use, and a page that is only looked at (Lighthouse, a quick glance) never downloads them.
 */

type Loader = () => Promise<unknown>;

const pending = new Set<Loader>();
let warmed = false;

function warmAll(): void {
  if (warmed) return;
  warmed = true;
  for (const load of pending) load().catch(() => undefined);
  pending.clear();
  for (const type of WARM_EVENTS) window.removeEventListener(type, warmAll, true);
}

const WARM_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;
if (typeof window !== "undefined") {
  for (const type of WARM_EVENTS) window.addEventListener(type, warmAll, { capture: true, passive: true });
}

/** A loader that runs once and is warmed on the first interaction. */
function warmable<P>(load: () => Promise<ComponentType<P>>): () => Promise<{ default: ComponentType<P> }> {
  let promise: Promise<{ default: ComponentType<P> }> | undefined;
  const run = () => {
    promise ??= load().then((component) => ({ default: component }));
    // A failed fetch (offline) is not cached, so the next open tries again.
    promise.catch(() => (promise = undefined));
    return promise;
  };
  if (warmed) run().catch(() => undefined);
  else pending.add(run);
  return run;
}

/** A `React.lazy` component that is also warmed on the first interaction (render it inside `<Suspense>`). */
export function lazyWarm<P>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  return lazy(warmable(load)) as unknown as ComponentType<P>;
}

/**
 * A controlled overlay (`open` / `onOpenChange`) that is loaded the first time `open` is true.
 * Until then it renders nothing — which is what the closed overlay renders anyway.
 */
export function lazyOverlay<P extends { open: boolean }>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Impl = lazyWarm(load);
  function LazyOverlay(props: P) {
    const [wanted, setWanted] = useState(props.open);
    if (props.open && !wanted) setWanted(true);
    if (!wanted) return null;
    return (
      <Suspense fallback={null}>
        <Impl {...props} />
      </Suspense>
    );
  }
  return LazyOverlay;
}

interface TriggeredProps {
  trigger: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A trigger-based overlay (menu, popover). Before first use it renders the trigger alone, with the
 * ARIA state the real trigger would have (`aria-haspopup`, `aria-expanded="false"`); activating it
 * loads the overlay and opens it. Hovering or focusing the trigger starts the download early.
 */
export function lazyTriggered<P extends TriggeredProps>(
  load: () => Promise<ComponentType<P>>,
  popup: "menu" | "dialog",
): ComponentType<P> {
  const run = warmable(load);
  const Impl = lazy(run) as unknown as ComponentType<P>;
  function LazyTriggered(props: P) {
    const [loaded, setLoaded] = useState(false);
    const [ownOpen, setOwnOpen] = useState(false);
    const controlled = props.open !== undefined;
    const open = controlled ? Boolean(props.open) : ownOpen;
    const setOpen = (next: boolean) => {
      if (!controlled) setOwnOpen(next);
      props.onOpenChange?.(next);
    };
    if (open && !loaded) setLoaded(true);

    const trigger = props.trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
    const placeholder = cloneElement(trigger, {
      "aria-haspopup": popup,
      "aria-expanded": false,
      "data-state": "closed",
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        trigger.props.onClick?.(event);
        if (event.defaultPrevented) return;
        setLoaded(true);
        setOpen(true);
      },
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        trigger.props.onPointerEnter?.(event);
        run().catch(() => undefined);
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        trigger.props.onFocus?.(event);
        run().catch(() => undefined);
      },
    } as React.HTMLAttributes<HTMLElement>);

    if (!loaded) return placeholder;
    return (
      <Suspense fallback={placeholder}>
        <Impl {...props} open={open} onOpenChange={setOpen} />
      </Suspense>
    );
  }
  return LazyTriggered;
}
