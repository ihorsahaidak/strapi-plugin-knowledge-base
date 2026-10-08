import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Loader,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tabs,
  Typography,
} from '@strapi/design-system';
import { ArrowClockwise } from '@strapi/icons';
import { Layouts, Page } from '@strapi/strapi/admin';

import EyeButton from '../components/EyeButton';
import KnowledgeHost from '../components/KnowledgeHost';
import { Textile } from '../utils/textile';
import { load, openTarget, reload, resolveEntry, useKnowledge } from '../store';
import {
  attributeHint,
  compKey,
  ctKey,
  targetFromKey,
  targetForComponent,
  targetForContentType,
  targetForField,
} from '../utils/keys';
import type { Entry, Schema, Target } from '../utils/types';

const ROW_LIMIT = 300;

type Row = {
  id: string;
  target: Target;
  name: string;
  kind: 'Collection type' | 'Single type' | 'Component' | 'Field';
  type: string;
  where: string;
};

/** Every documentable node of the project, flattened into one searchable list. */
const buildRows = (schema: Schema | null): Row[] => {
  if (!schema) return [];
  const rows: Row[] = [];

  for (const ct of schema.contentTypes) {
    rows.push({
      id: ct.uid,
      target: targetForContentType(ct),
      name: ct.displayName,
      kind: ct.kind === 'singleType' ? 'Single type' : 'Collection type',
      type: ct.uid,
      where: 'Content Manager',
    });

    for (const attr of ct.attributes) {
      // A component field is documented on the component itself, exactly like
      // the 👀 button inside the edit view does it.
      const component =
        attr.type === 'component' && attr.component
          ? schema.components.find((c) => c.uid === attr.component)
          : undefined;

      rows.push({
        id: `${ct.uid}#${attr.name}`,
        target: component ? targetForComponent(component) : targetForField(ct, ctKey(ct.uid), attr),
        name: attr.name,
        kind: 'Field',
        type: attributeHint(attr),
        where: ct.displayName,
      });
    }
  }

  for (const component of schema.components) {
    rows.push({
      id: component.uid,
      target: targetForComponent(component),
      name: component.displayName,
      kind: 'Component',
      type: component.uid,
      where: component.usedIn.length
        ? component.usedIn.map((u) => u.displayName).join(', ')
        : 'unused',
    });

    for (const attr of component.attributes) {
      rows.push({
        id: `${component.uid}#${attr.name}`,
        target: targetForField(component, compKey(component.uid), attr),
        name: attr.name,
        kind: 'Field',
        type: attributeHint(attr),
        where: component.uid,
      });
    }
  }

  return rows;
};

const entryText = (entry: Entry | null) => (entry?.description ?? '').toLowerCase();

const firstLine = (entry: Entry | null, length = 70) =>
  (entry?.description ?? '')
    .split('\n')
    .find((line) => line.trim())
    ?.replace(/^h[1-6]\.\s*/, '')
    .slice(0, length) ?? '';

const SettingsPage = () => {
  const { locale: adminLocale } = useIntl();
  const { status, error, schema, data } = useKnowledge();

  const [search, setSearch] = React.useState('');
  const [state, setState] = React.useState<'all' | 'documented' | 'undocumented' | 'untranslated'>('all');
  const [kind, setKind] = React.useState<'all' | 'types' | 'components' | 'fields'>('all');

  // The page owns the first fetch: KnowledgeHost renders below the loading
  // branch, so leaving the load to it would deadlock on an empty store.
  React.useEffect(() => {
    load(adminLocale);
  }, [adminLocale]);

  const rows = React.useMemo(() => buildRows(schema), [schema]);
  const query = search.trim().toLowerCase();

  const matches = React.useMemo(
    () =>
      rows.filter((row) => {
        if (kind === 'types' && !row.kind.endsWith('type')) return false;
        if (kind === 'components' && row.kind !== 'Component') return false;
        if (kind === 'fields' && row.kind !== 'Field') return false;

        const resolved = resolveEntry(data, row.target.key);
        if (state === 'documented' && !resolved.documented) return false;
        if (state === 'undocumented' && resolved.documented) return false;
        if (state === 'untranslated' && (!resolved.documented || resolved.translated)) return false;

        if (!query) return true;
        return (
          row.name.toLowerCase().includes(query) ||
          row.type.toLowerCase().includes(query) ||
          row.where.toLowerCase().includes(query) ||
          row.target.key.toLowerCase().includes(query) ||
          entryText(resolved.entry ?? resolved.fallback).includes(query)
        );
      }),
    [rows, data, query, state, kind]
  );

  const documentedCount = React.useMemo(
    () => rows.filter((row) => resolveEntry(data, row.target.key).documented).length,
    [rows, data]
  );

  /** Entries that exist in the files, whether or not the schema still has them. */
  const knowledgeEntries = React.useMemo(() => {
    const keys = new Set([...Object.keys(data?.entries ?? {}), ...Object.keys(data?.fallback ?? {})]);
    return [...keys]
      .map((key) => {
        const resolved = resolveEntry(data, key);
        return {
          key,
          entry: resolved.entry ?? resolved.fallback,
          translated: resolved.translated,
          target: schema ? targetFromKey(schema, key) : null,
        };
      })
      .filter(({ key, entry }) => {
        if (!query) return true;
        return entryText(entry).includes(query) || key.toLowerCase().includes(query);
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [data, schema, query]);

  if (status === 'loading' || status === 'idle') {
    return (
      <Layouts.Root>
        <Page.Main>
          <Box padding={10}>
            <Loader>Loading the knowledge base…</Loader>
          </Box>
        </Page.Main>
      </Layouts.Root>
    );
  }

  if (status === 'error') {
    return (
      <Layouts.Root>
        <Page.Main>
          <Layouts.Header
            title="Knowledge base"
            subtitle="Documentation for content types, components and fields"
          />
          <Layouts.Content>
            <Typography textColor="danger600">{error}</Typography>
          </Layouts.Content>
        </Page.Main>
      </Layouts.Root>
    );
  }

  return (
    <Layouts.Root>
      <Page.Main>
        <KnowledgeHost />
        <Layouts.Header
          title="Knowledge base"
          subtitle={`${documentedCount} of ${rows.length} documented · ${data?.locale} · ${data?.dataDir}`}
          primaryAction={
            <Button variant="tertiary" startIcon={<ArrowClockwise />} onClick={() => reload()}>
              Reload
            </Button>
          }
        />

        <Layouts.Content>
          <Flex direction="column" alignItems="stretch" gap={4}>
            {!data?.writable ? (
              <Box padding={3} hasRadius background="warning100">
                <Typography variant="pi" textColor="warning600">
                  Read-only: the knowledge base directory cannot be written here. Edit the JSON files
                  in the repository instead.
                </Typography>
              </Box>
            ) : null}

            <Box padding={4} hasRadius background="neutral0" shadow="tableShadow">
              <Flex direction="column" alignItems="stretch" gap={3}>
                <Searchbar
                  name="kb-search"
                  value={search}
                  onChange={(e: any) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                  clearLabel="Clear the search"
                  placeholder="Search fields, components, descriptions…"
                  size="M"
                >
                  Search the knowledge base
                </Searchbar>

                <Flex gap={2} wrap="wrap">
                  <Box minWidth="200px">
                    <SingleSelect value={kind} onChange={(v: any) => setKind(v)} aria-label="Kind">
                      <SingleSelectOption value="all">Everything</SingleSelectOption>
                      <SingleSelectOption value="types">Content types</SingleSelectOption>
                      <SingleSelectOption value="components">Components</SingleSelectOption>
                      <SingleSelectOption value="fields">Fields</SingleSelectOption>
                    </SingleSelect>
                  </Box>
                  <Box minWidth="220px">
                    <SingleSelect value={state} onChange={(v: any) => setState(v)} aria-label="State">
                      <SingleSelectOption value="all">Any state</SingleSelectOption>
                      <SingleSelectOption value="documented">Documented</SingleSelectOption>
                      <SingleSelectOption value="undocumented">Not documented</SingleSelectOption>
                      <SingleSelectOption value="untranslated">
                        Missing in {data?.locale}
                      </SingleSelectOption>
                    </SingleSelect>
                  </Box>
                  <Box minWidth="160px">
                    <SingleSelect
                      value={data?.locale}
                      onChange={(value: any) => load(String(value), true)}
                      aria-label="Language"
                    >
                      {(data?.locales ?? [adminLocale]).map((code) => (
                        <SingleSelectOption key={code} value={code}>
                          {code}
                          {code === data?.fallbackLocale ? ' (default)' : ''}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Box>
                </Flex>
              </Flex>
            </Box>

            <Tabs.Root defaultValue="schema">
              <Tabs.List aria-label="Knowledge base views">
                <Tabs.Trigger value="schema">Fields &amp; types ({matches.length})</Tabs.Trigger>
                <Tabs.Trigger value="entries">Knowledge base ({knowledgeEntries.length})</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="schema">
                <Box paddingTop={4}>
                  <Table colCount={6} rowCount={Math.min(matches.length, ROW_LIMIT)}>
                    <Thead>
                      <Tr>
                        <Th>
                          <Typography variant="sigma">Name</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Kind</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Type</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Where</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Documentation</Typography>
                        </Th>
                        <Th>
                          <Typography variant="sigma">Open</Typography>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {matches.slice(0, ROW_LIMIT).map((row) => {
                        const resolved = resolveEntry(data, row.target.key);
                        const entry = resolved.entry ?? resolved.fallback;
                        return (
                          <Tr
                            key={row.id}
                            onClick={() => openTarget(row.target)}
                            style={{ cursor: 'pointer' }}
                          >
                            <Td>
                              <Typography fontWeight="semiBold">{row.name}</Typography>
                            </Td>
                            <Td>
                              <Typography textColor="neutral600">{row.kind}</Typography>
                            </Td>
                            <Td>
                              <Typography variant="pi" textColor="neutral600">
                                {row.type}
                              </Typography>
                            </Td>
                            <Td>
                              <Typography variant="pi" textColor="neutral600">
                                {row.where}
                              </Typography>
                            </Td>
                            <Td>
                              {resolved.documented ? (
                                <Flex gap={2} alignItems="center">
                                  <Typography variant="pi" ellipsis>
                                    {firstLine(entry)}
                                  </Typography>
                                  {!resolved.translated ? <Badge>{data?.fallbackLocale}</Badge> : null}
                                </Flex>
                              ) : (
                                <Typography variant="pi" textColor="neutral500">
                                  —
                                </Typography>
                              )}
                            </Td>
                            <Td>
                              <EyeButton target={row.target} size={16} />
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                  {matches.length > ROW_LIMIT ? (
                    <Box paddingTop={2}>
                      <Typography variant="pi" textColor="neutral600">
                        Showing the first {ROW_LIMIT} of {matches.length} — narrow the search.
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              </Tabs.Content>

              <Tabs.Content value="entries">
                <Flex direction="column" alignItems="stretch" gap={3} paddingTop={4}>
                  {knowledgeEntries.length === 0 ? (
                    <Typography textColor="neutral600">
                      Nothing documented yet. Open any content type, component or field and press 👀.
                    </Typography>
                  ) : null}

                  {knowledgeEntries.map(({ key, entry, translated, target }) => (
                    <Box key={key} padding={4} hasRadius background="neutral0" shadow="tableShadow">
                      <Flex justifyContent="space-between" alignItems="start" gap={4}>
                        <Box grow={1}>
                          <Flex gap={2} alignItems="center">
                            <Typography fontWeight="bold">{target?.label ?? key}</Typography>
                            {!translated ? <Badge>{data?.fallbackLocale} only</Badge> : null}
                            {!target ? <Badge textColor="danger600">orphan</Badge> : null}
                          </Flex>
                          <Typography variant="pi" textColor="neutral500">
                            {key}
                          </Typography>
                          <Box paddingTop={2}>
                            <Textile text={entry?.description} />
                          </Box>
                        </Box>
                        {target ? <EyeButton target={target} size={16} /> : null}
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </Tabs.Content>
            </Tabs.Root>

            <Divider />
            <Typography variant="pi" textColor="neutral600">
              Entries are stored as JSON, one file per language, in {data?.dataDir}. Commit them with
              the rest of the project.
            </Typography>
          </Flex>
        </Layouts.Content>
      </Page.Main>
    </Layouts.Root>
  );
};

export default SettingsPage;
