"use client";

import { useSyncExternalStore } from "react";

export type UpgradeModalState = {
  open: boolean;
  /** Short label for the limit or feature that triggered the modal. */
  reason: string | null;
};

let state: UpgradeModalState = { open: false, reason: null };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UpgradeModalState {
  return state;
}

/** Open from any client handler when a gated action returns QUOTA_EXCEEDED / PRO_REQUIRED. */
export function openUpgradeModal(reason?: string): void {
  state = { open: true, reason: reason ?? null };
  emit();
}

export function closeUpgradeModal(): void {
  state = { open: false, reason: null };
  emit();
}

export function useUpgradeModal(): UpgradeModalState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
