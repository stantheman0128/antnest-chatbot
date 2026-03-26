"use client";

import type Liff from "@line/liff";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export type LiffState =
  | { status: "loading" }
  | { status: "ready"; profile: LiffProfile; isInClient: boolean }
  | { status: "error"; error: string };

let liffInstance: typeof Liff | null = null;
let initPromise: Promise<typeof Liff> | null = null;

/**
 * Initialize LIFF SDK (singleton — safe to call multiple times).
 * Dynamically imports @line/liff to avoid SSR crash.
 */
export async function initLiff(): Promise<typeof Liff> {
  if (liffInstance) return liffInstance;
  if (initPromise) return initPromise;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error("NEXT_PUBLIC_LIFF_ID is not configured");

  initPromise = (async () => {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId });

    // External browser: not logged in → redirect to LINE Login
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      // login() redirects away, this promise never resolves in this session
      return new Promise<never>(() => {});
    }

    liffInstance = liff;
    return liff;
  })();

  return initPromise;
}

/**
 * Get LINE profile from initialized LIFF SDK.
 */
export async function getLiffProfile(): Promise<LiffProfile> {
  const liff = await initLiff();
  const profile = await liff.getProfile();
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl || undefined,
  };
}

/**
 * Check if running inside LINE app.
 */
export async function isInClient(): Promise<boolean> {
  const liff = await initLiff();
  return liff.isInClient();
}

/**
 * Close LIFF window (only works inside LINE app).
 */
export async function closeLiff(): Promise<void> {
  const liff = await initLiff();
  if (liff.isInClient()) liff.closeWindow();
}
