"use client";

import { useSyncExternalStore } from "react";

import type { UpgradeTarget } from "@/features/billing/present";

export type UpgradeModalState = {
  open: boolean;
  /** The limit or Pro feature that opened the modal. */
  target: UpgradeTarget | null;
};

let state: UpgradeModalState = { open: false, target: null };
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
export function openUpgradeModal(target: UpgradeTarget): void {
  state = { open: true, target };
  emit();
}

export function closeUpgradeModal(): void {
  state = { open: false, target: null };
  emit();
}

export function useUpgradeModal(): UpgradeModalState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
