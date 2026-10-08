import * as React from 'react';

import { deleteEntry, fetchEntries, fetchSchema, putEntry } from './utils/api';
import type { EntriesPayload, Entry, Schema, Target } from './utils/types';

/**
 * A module-level store rather than a React context.
 *
 * The 👀 buttons are mounted through several separate Content Manager injection
 * zones (list view, edit view) plus the settings page, and those trees share no
 * common ancestor we can wrap — so the schema, the entries and the currently
 * open modal live outside React and every mount point subscribes to them.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error';

export type KnowledgeState = {
  status: Status;
  error: string | null;
  schema: Schema | null;
  data: EntriesPayload | null;
  /** Admin UI language the entries were loaded for. */
  locale: string | null;
  open: Target | null;
  saving: boolean;
  /** Which mount point renders the modal (the first one to claim it). */
  hostId: string | null;
};

const INITIAL: KnowledgeState = {
  status: 'idle',
  error: null,
  schema: null,
  data: null,
  locale: null,
  open: null,
  saving: false,
  hostId: null,
};

let state: KnowledgeState = INITIAL;
const listeners = new Set<() => void>();

const set = (patch: Partial<KnowledgeState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getState = () => state;

export const useKnowledge = () => React.useSyncExternalStore(subscribe, getState, getState);

let inFlight: Promise<void> | null = null;
let inFlightLocale: string | null = null;

/** Loads the schema once and the entries once per language. */
export const load = (locale: string, force = false): Promise<void> => {
  if (!force && state.status === 'ready' && state.locale === locale) return Promise.resolve();
  if (inFlight && inFlightLocale === locale && !force) return inFlight;

  inFlightLocale = locale;
  set({ status: 'loading', error: null });

  inFlight = (async () => {
    try {
      const [schema, data] = await Promise.all([
        state.schema && !force ? Promise.resolve(state.schema) : fetchSchema(),
        fetchEntries(locale),
      ]);
      set({ status: 'ready', schema, data, locale, error: null });
    } catch (error: any) {
      set({
        status: 'error',
        error: error?.response?.data?.error?.message ?? error?.message ?? 'Request failed',
      });
    } finally {
      inFlight = null;
      inFlightLocale = null;
    }
  })();

  return inFlight;
};

export const reload = () => load(state.locale ?? 'en', true);

export const openTarget = (target: Target) => set({ open: target });
export const closeTarget = () => set({ open: null });

export const claimHost = (id: string) => {
  if (state.hostId === null) set({ hostId: id });
};

export const releaseHost = (id: string) => {
  if (state.hostId === id) set({ hostId: null, open: null });
};

const replaceEntry = (key: string, entry: Entry | null) => {
  if (!state.data) return;
  const entries = { ...state.data.entries };
  if (entry) entries[key] = entry;
  else delete entries[key];
  set({ data: { ...state.data, entries } });
};

export const save = async (key: string, entry: Entry | null): Promise<void> => {
  if (!state.data) return;
  set({ saving: true });
  try {
    const saved = await putEntry(state.data.locale, key, entry);
    replaceEntry(key, saved);
  } finally {
    set({ saving: false });
  }
};

export const remove = async (key: string): Promise<void> => {
  if (!state.data) return;
  set({ saving: true });
  try {
    await deleteEntry(state.data.locale, key);
    replaceEntry(key, null);
  } finally {
    set({ saving: false });
  }
};

export type ResolvedEntry = {
  entry: Entry | null;
  /** Shown instead when the language has no entry of its own. */
  fallback: Entry | null;
  documented: boolean;
  translated: boolean;
};

export const resolveEntry = (data: EntriesPayload | null, key: string): ResolvedEntry => {
  const entry = data?.entries?.[key] ?? null;
  const fallback = data?.fallback?.[key] ?? null;
  return {
    entry,
    fallback,
    documented: !!entry || !!fallback,
    translated: !!entry,
  };
};
