import * as React from "react";

export type FeelId = "web" | "macos" | "ios" | "windows";

export const feels: readonly FeelId[] = ["web", "macos", "ios", "windows"];
export const isFeel = (value: unknown): value is FeelId => feels.includes(value as FeelId);

/** Where an app's choice is remembered, so an override survives a reload. */
export const feelStorageKey = "ballmac-feel";

/**
 * The feel that matches the device the page is running on. Works in a browser, a Tauri window and an Electron window, because
 * all of them report the platform in the user agent. An iPad that asks for the desktop site still counts as iOS.
 */
export function detectFeel(
  nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> = navigator,
): FeelId {
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1))
    return "ios";
  if (/Macintosh|Mac OS X/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  return "web";
}

const attribute = "data-feel";

/** The feel set on the page, or "web" when none is. */
export function readFeel(
  el: Element | null = typeof document === "undefined" ? null : document.documentElement,
): FeelId {
  const value = el?.closest(`[${attribute}]`)?.getAttribute(attribute);
  return isFeel(value) ? value : "web";
}

/** The choice remembered for this browser, if any. */
export function storedFeel(): FeelId | null {
  try {
    const value = localStorage.getItem(feelStorageKey);
    return isFeel(value) ? value : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/**
 * Sets the feel for the whole page. `"auto"` goes back to the device's own feel and forgets the override. The choice is
 * remembered in localStorage when that is available.
 */
export function setFeel(feel: FeelId | "auto") {
  if (typeof document === "undefined") return;
  const next = feel === "auto" ? detectFeel() : feel;
  document.documentElement.setAttribute(attribute, next);
  try {
    if (feel === "auto") localStorage.removeItem(feelStorageKey);
    else localStorage.setItem(feelStorageKey, feel);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const observer = new MutationObserver(listener);
  if (typeof document !== "undefined")
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
  return () => {
    listeners.delete(listener);
    observer.disconnect();
  };
}

/**
 * The feel the page is set to, live. Server render and the first client render say "web", then the real value is read, so
 * markup always matches. Pass an element to read a scope inside the page.
 */
export function useFeel(): { feel: FeelId; setFeel: typeof setFeel } {
  const feel = React.useSyncExternalStore(
    subscribe,
    () => readFeel(),
    () => "web" as FeelId,
  );
  return { feel, setFeel };
}

/**
 * A script for the document head that sets the feel before the first paint, so there is no flash: the remembered choice, else
 * the device's own feel. Rendered by FeelScript.
 */
export const feelScript = `(function(){try{var k="${feelStorageKey}",f=["web","macos","ios","windows"],s=null;try{s=localStorage.getItem(k)}catch(e){}var n=navigator,u=n.userAgent,d="web";if(/iPhone|iPad|iPod/.test(u)||(n.platform==="MacIntel"&&n.maxTouchPoints>1))d="ios";else if(/Macintosh|Mac OS X/.test(u))d="macos";else if(/Windows/.test(u))d="windows";document.documentElement.setAttribute("${attribute}",f.indexOf(s)>-1?s:d)}catch(e){}})()`;
