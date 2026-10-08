import * as React from 'react';
import {
  Box,
  Button,
  Divider,
  Field,
  Flex,
  Modal,
  Textarea,
  Typography,
} from '@strapi/design-system';
import { useNotification } from '@strapi/strapi/admin';

import Chip from './Chip';
import { closeTarget, remove, resolveEntry, save, useKnowledge } from '../store';
import { Textile } from '../utils/textile';
import { attributeHint, parseKey } from '../utils/keys';
import type { Entry, Schema, Target, UsageRef } from '../utils/types';

const KIND_LABEL: Record<Target['kind'], string> = {
  contentType: 'Collection type',
  component: 'Component',
  field: 'Field',
};

/** Places the documented node actually appears, straight from the schema. */
const usageOf = (schema: Schema | null, target: Target): UsageRef[] => {
  const parsed = parseKey(target.key);
  if (!schema || !parsed) return [];

  // A component — or any field of it — lives everywhere the component is used.
  if (parsed.scope === 'comp') {
    return schema.components.find((c) => c.uid === parsed.uid)?.usedIn ?? [];
  }
  return [];
};

const UsageList = ({ schema, target }: { schema: Schema | null; target: Target }) => {
  const usage = usageOf(schema, target);
  const parsed = parseKey(target.key);

  if (parsed?.scope === 'ct') {
    const ct = schema?.contentTypes.find((c) => c.uid === parsed.uid);
    return (
      <Typography variant="pi" textColor="neutral600">
        {parsed.field
          ? `Field of ${ct?.displayName ?? parsed.uid} — used on this content type only.`
          : `${ct?.kind === 'singleType' ? 'Single type' : 'Collection type'} · ${
              ct?.attributes.length ?? 0
            } fields`}
      </Typography>
    );
  }

  if (!usage.length) {
    return (
      <Typography variant="pi" textColor="neutral600">
        Not used anywhere yet.
      </Typography>
    );
  }

  return (
    <Flex direction="row" gap={1} wrap="wrap">
      {usage.map((ref) => (
        <Chip key={`${ref.uid}-${ref.field}`}>
          {`${ref.displayName} › ${ref.field}${ref.dynamicZone ? ' (dz)' : ''}${
            ref.repeatable ? ' ×n' : ''
          }`}
        </Chip>
      ))}
    </Flex>
  );
};

const KnowledgeModal = () => {
  const { open, data, schema, saving } = useKnowledge();
  const { toggleNotification } = useNotification();

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [preview, setPreview] = React.useState(false);

  const target = open;
  const resolved = resolveEntry(data, target?.key ?? '');
  const shown = resolved.entry ?? resolved.fallback;

  React.useEffect(() => {
    // A different button was clicked: drop any half-written text.
    setEditing(false);
    setPreview(false);
    setDraft(data?.entries?.[target?.key ?? '']?.description ?? '');
  }, [target?.key, data]);

  if (!target) return null;

  const editable = !!data?.canEdit && !!data?.writable;

  const persist = async (entry: Entry | null, message: string) => {
    try {
      await save(target.key, entry);
      setEditing(false);
      toggleNotification({ type: 'success', message });
    } catch (error: any) {
      toggleNotification({
        type: 'danger',
        message: error?.response?.data?.error?.message ?? 'Could not save the documentation.',
      });
    }
  };

  const onDelete = async () => {
    try {
      await remove(target.key);
      setEditing(false);
      setDraft('');
      toggleNotification({ type: 'success', message: 'Documentation removed.' });
    } catch (error: any) {
      toggleNotification({
        type: 'danger',
        message: error?.response?.data?.error?.message ?? 'Could not remove the documentation.',
      });
    }
  };

  return (
    <Modal.Root open onOpenChange={(isOpen: boolean) => !isOpen && closeTarget()}>
      <Modal.Content>
        <Modal.Header>
          <Typography fontWeight="bold" variant="beta" tag="h2">
            👀 {target.label}
          </Typography>
        </Modal.Header>

        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            {editing ? (
              <>
                <Box>
                  <Typography variant="pi" textColor="neutral600">
                    {KIND_LABEL[target.kind]} · {target.ownerLabel}
                    {target.fieldName ? ` › ${target.fieldName}` : ''}
                    {target.attribute ? ` · ${attributeHint(target.attribute)}` : ''}
                  </Typography>
                  <Box paddingTop={2}>
                    <UsageList schema={schema} target={target} />
                  </Box>
                </Box>

                <Divider />

                <Field.Root name="kb-description">
                  <Field.Label>Textile — the same syntax as Redmine</Field.Label>
                  <Textarea
                    rows={10}
                    value={draft}
                    placeholder="What this is, what belongs in it, where it shows up, what to avoid. Textile, as in Redmine."
                    onChange={(e: any) => setDraft(e.target.value)}
                  />
                </Field.Root>

                <Flex justifyContent="space-between" alignItems="center">
                  <Button variant="tertiary" onClick={() => setPreview((value) => !value)}>
                    {preview ? 'Hide preview' : 'Preview'}
                  </Button>
                  {!resolved.translated && resolved.fallback?.description ? (
                    <Button
                      variant="tertiary"
                      onClick={() => setDraft(resolved.fallback?.description ?? '')}
                    >
                      Copy from {data?.fallbackLocale}
                    </Button>
                  ) : null}
                </Flex>

                {preview ? (
                  <Box padding={3} hasRadius background="neutral0" shadow="tableShadow">
                    <Textile text={draft} />
                  </Box>
                ) : null}
              </>
            ) : shown?.description ? (
              <Flex direction="column" alignItems="stretch" gap={3}>
                {!resolved.translated ? (
                  <Typography variant="pi" textColor="warning600">
                    Not translated into {data?.locale} — showing {data?.fallbackLocale}.
                  </Typography>
                ) : null}

                <Textile text={shown.description} />
              </Flex>
            ) : (
              <Typography textColor="neutral600">
                Nothing documented yet{editable ? ' — press the button below to write it.' : '.'}
              </Typography>
            )}
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          <Flex justifyContent="space-between" width="100%">
            <Box>
              {editing && resolved.entry ? (
                <Button variant="danger-light" onClick={onDelete} disabled={saving}>
                  Delete
                </Button>
              ) : null}
            </Box>

            <Flex gap={2}>
              {editing ? (
                <>
                  <Button variant="tertiary" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => persist(draft.trim() ? { description: draft } : null, 'Documentation saved.')}
                    loading={saving}
                  >
                    Save in {data?.locale}
                  </Button>
                </>
              ) : editable ? (
                <Button onClick={() => setEditing(true)}>
                  {resolved.entry ? 'Edit' : 'Document this'}
                </Button>
              ) : (
                <Button variant="tertiary" onClick={closeTarget}>
                  Close
                </Button>
              )}
            </Flex>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default KnowledgeModal;
