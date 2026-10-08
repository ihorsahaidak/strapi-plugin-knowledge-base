import { getFetchClient } from '@strapi/strapi/admin';

import type { EntriesPayload, Entry, Schema } from './types';

const BASE = '/knowledge-base';

export const fetchSchema = async (): Promise<Schema> => {
  const { get } = getFetchClient();
  const { data } = await get(`${BASE}/schema`);
  return data as Schema;
};

export const fetchEntries = async (locale: string): Promise<EntriesPayload> => {
  const { get } = getFetchClient();
  const { data } = await get(`${BASE}/entries?locale=${encodeURIComponent(locale)}`);
  return data as EntriesPayload;
};

export const putEntry = async (
  locale: string,
  key: string,
  entry: Entry | null
): Promise<Entry | null> => {
  const { put } = getFetchClient();
  const { data } = await put(`${BASE}/entries`, { locale, key, entry });
  return ((data as { entry?: Entry } | undefined)?.entry as Entry) ?? null;
};

export const deleteEntry = async (locale: string, key: string): Promise<void> => {
  const { post } = getFetchClient();
  await post(`${BASE}/entries/delete`, { locale, key });
};
