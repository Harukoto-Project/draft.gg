"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useMessages } from "@/lib/ballmac/i18n";
import { useFeel, type FeelId } from "@/lib/ballmac/feel";

type AppWindowContextValue = {
  feel: FeelId;
  active: boolean;
  maximized: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFullscreen?: () => void;
};

const AppWindowContext = React.createContext<AppWindowContextValue>({
  feel: "web",
  active: true,
  maximized: false,
});

// Tauri reads `data-tauri-drag-region`; Electron reads the CSS property. Both are set, so the same bar drags in either.
const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

const subscribeFocus = (cb: () => void) => {
  window.addEventListener("focus", cb);
  window.addEventListener("blur", cb);
  return () => {
    window.removeEventListener("focus", cb);
    window.removeEventListener("blur", cb);
  };
};

/** Whether this window has focus, so a window in the background dims as it does on the desktop. */
function useWindowFocus() {
  return React.useSyncExternalStore(
    subscribeFocus,
    () => document.hasFocus(),
    () => true,
  );
}

type AppWindowProps = React.ComponentProps<"div"> & {
  /** Which platform's chrome to draw. Defaults to the page's feel (`data-feel`), which Feel Auto sets from the device. */
  feel?: FeelId;
  /** Whether the window is the focused one. Defaults to following the real window focus. */
  active?: boolean;
  /** The window fills the screen: corners square off and the Windows button shows "restore". */
  maximized?: boolean;
  /** Called by the close button. Without a handler the button is drawn but not focusable. */
  onClose?: () => void;
  /** Called by the minimize button. */
  onMinimize?: () => void;
  /** Called by the maximize (Windows) or zoom (macOS) button, and when the title bar is double-clicked. */
  onMaximize?: () => void;
  /** Called by the macOS green button; hold Option to call onMaximize instead. Falls back to onMaximize. */
  onFullscreen?: () => void;
};

/**
 * The frame of a desktop app window: a title bar that drags the window and carries the controls the platform draws (traffic
 * lights on the left for macOS, minimize, maximize and close on the right for Windows, none for iOS and web), and the content.
 * It draws chrome only; you wire the callbacks to Tauri's `getCurrentWindow()` or Electron's IPC.
 */
function AppWindow({
  feel: feelProp,
  active,
  maximized = false,
  onClose,
  onMinimize,
  onMaximize,
  onFullscreen,
  className,
  ...props
}: AppWindowProps) {
  const page = useFeel().feel;
  const focused = useWindowFocus();
  const feel = feelProp ?? page;
  const isActive = active ?? focused;
  const value = React.useMemo(
    () => ({ feel, active: isActive, maximized, onClose, onMinimize, onMaximize, onFullscreen }),
    [feel, isActive, maximized, onClose, onMinimize, onMaximize, onFullscreen],
  );
  return (
    <AppWindowContext.Provider value={value}>
      <div
        data-slot="app-window"
        data-feel={feel}
        data-state={isActive ? "active" : "inactive"}
        data-maximized={maximized || undefined}
        className={cn(
          "group/app-window relative isolate flex min-h-0 min-w-0 flex-col overflow-hidden bg-card text-card-foreground",
          maximized ? "rounded-none" : "rounded-xl border border-border",
          className,
        )}
        {...props}
      />
    </AppWindowContext.Provider>
  );
}

const lights = {
  close: <path d="M3.5 3.5l5 5m0-5l-5 5" strokeWidth="1.3" strokeLinecap="round" />,
  minimize: <path d="M3 6h6" strokeWidth="1.4" strokeLinecap="round" />,
  zoom: <path d="M3.4 8.6V5l3.6 3.6zM8.6 3.4V7L5 3.4z" stroke="none" fill="currentColor" />,
  plus: <path d="M6 3v6M3 6h6" strokeWidth="1.3" strokeLinecap="round" />,
} as const;

function TrafficLight({
  kind,
  glyph,
  label,
  onPress,
}: {
  kind: "close" | "minimize" | "zoom";
  glyph: keyof typeof lights;
  label: string;
  onPress?: () => void;
}) {
  const shared = cn(
    "relative flex size-[12px] shrink-0 items-center justify-center rounded-full text-black/60 outline-none",
    "bg-(--light) shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.18)] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.12)]",
    "group-data-[state=inactive]/app-window:bg-foreground/15 group-data-[state=inactive]/app-window:group-hover/lights:bg-(--light)",
  );
  const style = {
    "--light": `var(--mac-${kind}, ${kind === "close" ? "oklch(0.7 0.19 25)" : kind === "minimize" ? "oklch(0.84 0.16 84)" : "oklch(0.76 0.19 145)"})`,
    ...noDrag,
  } as React.CSSProperties;
  const icon = (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      stroke="currentColor"
      fill="none"
      className="size-3 opacity-0 transition-opacity duration-100 group-hover/lights:opacity-100 group-has-[:focus-visible]/lights:opacity-100"
    >
      {lights[glyph]}
    </svg>
  );
  if (!onPress)
    return (
      <span data-slot={`app-window-${kind}`} className={shared} style={style} aria-hidden="true">
        {icon}
      </span>
    );
  return (
    <button
      type="button"
      data-slot={`app-window-${kind}`}
      aria-label={label}
      onClick={onPress}
      className={cn(shared, "focus-visible:ring-[3px] focus-visible:ring-ring/50")}
      style={style}
    >
      {icon}
    </button>
  );
}

function MacControls() {
  const { onClose, onMinimize, onMaximize, onFullscreen } = React.useContext(AppWindowContext);
  const msg = useMessages();
  // Holding Option turns the green button from full screen into a plain zoom, as it does on macOS.
  const [alt, setAlt] = React.useState(false);
  React.useEffect(() => {
    const set = (e: KeyboardEvent) => setAlt(e.altKey);
    window.addEventListener("keydown", set);
    window.addEventListener("keyup", set);
    return () => {
      window.removeEventListener("keydown", set);
      window.removeEventListener("keyup", set);
    };
  }, []);
  const zoom = alt && onFullscreen ? onMaximize : (onFullscreen ?? onMaximize);
  // 12 px lights 12 px apart keep every target 24 px from its neighbours, which is what WCAG 2.5.8 asks of small targets
  return (
    <div
      data-slot="app-window-controls"
      dir="ltr"
      className="group/lights flex shrink-0 items-center gap-[12px]"
      style={noDrag}
    >
      <TrafficLight
        kind="close"
        glyph="close"
        label={msg("app-window.close", "Close window")}
        onPress={onClose}
      />
      <TrafficLight
        kind="minimize"
        glyph="minimize"
        label={msg("app-window.minimize", "Minimize window")}
        onPress={onMinimize}
      />
      <TrafficLight
        kind="zoom"
        glyph={alt ? "plus" : "zoom"}
        label={
          alt
            ? msg("app-window.zoom", "Zoom window")
            : msg("app-window.fullscreen", "Enter full screen")
        }
        onPress={zoom}
      />
    </div>
  );
}

const caption = {
  minimize: <path d="M0 5h10" />,
  maximize: <rect x="0.5" y="0.5" width="9" height="9" rx="1" />,
  restore: (
    <>
      <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
    </>
  ),
  close: <path d="M0.5 0.5l9 9m0-9l-9 9" />,
} as const;

function CaptionButton({
  kind,
  label,
  onPress,
}: {
  kind: keyof typeof caption;
  label: string;
  onPress?: () => void;
}) {
  return (
    <button
      type="button"
      data-slot={`app-window-${kind}`}
      aria-label={label}
      aria-disabled={onPress ? undefined : true}
      tabIndex={onPress ? undefined : -1}
      onClick={onPress}
      style={noDrag}
      className={cn(
        "flex h-full w-[46px] cursor-default items-center justify-center rounded-none text-foreground outline-none transition-colors duration-100 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
        "group-data-[state=inactive]/app-window:text-muted-foreground",
        kind === "close"
          ? "hover:bg-destructive hover:text-white active:bg-destructive/90"
          : "hover:bg-foreground/[0.06] active:bg-foreground/[0.04]",
      )}
    >
      <svg
        viewBox="0 0 10 10"
        width="10"
        height="10"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        {caption[kind]}
      </svg>
    </button>
  );
}

function WindowsControls() {
  const { maximized, onClose, onMinimize, onMaximize } = React.useContext(AppWindowContext);
  const msg = useMessages();
  return (
    <div data-slot="app-window-controls" dir="ltr" className="flex h-full shrink-0 items-stretch">
      <CaptionButton
        kind="minimize"
        label={msg("app-window.minimize", "Minimize window")}
        onPress={onMinimize}
      />
      <CaptionButton
        kind={maximized ? "restore" : "maximize"}
        label={
          maximized
            ? msg("app-window.restore", "Restore window")
            : msg("app-window.maximize", "Maximize window")
        }
        onPress={onMaximize}
      />
      <CaptionButton
        kind="close"
        label={msg("app-window.close", "Close window")}
        onPress={onClose}
      />
    </div>
  );
}

type AppWindowControlsProps = { feel?: FeelId };

/** Just the window controls the platform draws, for a custom title bar. Draws nothing for iOS and web. */
function AppWindowControls({ feel: feelProp }: AppWindowControlsProps) {
  const { feel: ctx } = React.useContext(AppWindowContext);
  const feel = feelProp ?? ctx;
  if (feel === "macos") return <MacControls />;
  if (feel === "windows") return <WindowsControls />;
  return null;
}

type AppWindowTitleBarProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** The window title. Centered on macOS and iOS, at the start beside the icon on Windows. */
  title?: React.ReactNode;
  /** A small icon before the title (Windows). */
  icon?: React.ReactNode;
  /** Items after the controls and title, at the start (a back button, a sidebar toggle). */
  leading?: React.ReactNode;
  /** Draw the window controls. Turn off when something else draws them. */
  controls?: boolean;
};

/**
 * The title bar. It drags the window (Tauri and Electron), maximizes on double-click, and sizes itself from the feel
 * (`--bm-titlebar-h`). Children become the trailing toolbar; buttons inside it stay clickable.
 */
function AppWindowTitleBar({
  title,
  icon,
  leading,
  controls = true,
  className,
  children,
  onDoubleClick,
  ...props
}: AppWindowTitleBarProps) {
  const { feel, onMaximize } = React.useContext(AppWindowContext);
  const mac = feel === "macos";
  const win = feel === "windows";
  return (
    <div
      data-slot="app-window-titlebar"
      data-tauri-drag-region=""
      style={drag}
      onDoubleClick={(e) => {
        onDoubleClick?.(e);
        // only the bar itself and its title, never a button or field inside it
        if (
          !e.defaultPrevented &&
          onMaximize &&
          (e.target === e.currentTarget ||
            (e.target as Element).closest("[data-slot=app-window-title]"))
        )
          onMaximize();
      }}
      className={cn(
        "relative flex h-[var(--bm-titlebar-h,2.5rem)] shrink-0 items-center gap-2 border-b border-border bg-card select-none",
        win ? "ps-3" : "px-3",
        className,
      )}
      {...props}
    >
      {controls && mac ? <AppWindowControls /> : null}
      {win && icon ? (
        <span
          data-slot="app-window-icon"
          className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
          style={noDrag}
        >
          {icon}
        </span>
      ) : null}
      {title ? (
        <div
          data-slot="app-window-title"
          className={cn(
            "truncate font-semibold text-foreground/85 group-data-[state=inactive]/app-window:text-muted-foreground",
            win
              ? "min-w-0 text-xs font-normal"
              : "pointer-events-none absolute inset-x-24 text-center text-sm",
          )}
        >
          {title}
        </div>
      ) : null}
      {leading ? (
        <div
          data-slot="app-window-leading"
          className="relative z-10 flex items-center gap-1"
          style={noDrag}
        >
          {leading}
        </div>
      ) : null}
      {children ? (
        <div
          data-slot="app-window-toolbar"
          className="relative z-10 ms-auto flex min-w-0 items-center gap-1 text-foreground/70 group-data-[state=inactive]/app-window:text-foreground/40"
          style={noDrag}
        >
          {children}
        </div>
      ) : null}
      {controls && win ? (
        <div className={cn("h-full", children ? "" : "ms-auto")}>
          <AppWindowControls />
        </div>
      ) : null}
    </div>
  );
}

type AppWindowContentProps = React.ComponentProps<"div">;

/** The scrollable area under the title bar. */
function AppWindowContent({ className, ...props }: AppWindowContentProps) {
  return (
    <div
      data-slot="app-window-content"
      className={cn("min-h-0 flex-1 overflow-auto", className)}
      {...props}
    />
  );
}

export { AppWindow, AppWindowTitleBar, AppWindowControls, AppWindowContent };
export type {
  AppWindowProps,
  AppWindowTitleBarProps,
  AppWindowControlsProps,
  AppWindowContentProps,
};
