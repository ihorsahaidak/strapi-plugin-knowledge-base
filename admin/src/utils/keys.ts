import type { AttributeInfo, ComponentInfo, ContentTypeInfo, Schema, Target } from './types';

/**
 * Entry keys are stable identifiers for a *schema node*, never for a document:
 *
 *   ct:api::page.page            a content type
 *   ct:api::page.page#slug       one of its own fields
 *   comp:shared.seo              a component
 *   comp:shared.seo#metaTitle    one of the component's fields
 *
 * Documenting the component rather than each place it is embedded is the point:
 * write it once and it shows up under every content type that uses it.
 */
export const ctKey = (uid: string) => `ct:${uid}`;
export const compKey = (uid: string) => `comp:${uid}`;
export const fieldKey = (ownerKey: string, field: string) => `${ownerKey}#${field}`;

export type ParsedKey = { scope: 'ct' | 'comp'; uid: string; field?: string };

export const parseKey = (key: string): ParsedKey | null => {
  const match = /^(ct|comp):([^#]+)(?:#(.+))?$/.exec(key ?? '');
  if (!match) return null;
  return { scope: match[1] as 'ct' | 'comp', uid: match[2], field: match[3] };
};

export const componentLabel = (component: ComponentInfo) =>
  `${component.category} › ${component.displayName}`;

export const attributeHint = (attr: AttributeInfo) => {
  if (attr.type === 'relation') return `relation → ${attr.target ?? '?'}`;
  if (attr.type === 'component') return `component → ${attr.component}${attr.repeatable ? ' (repeatable)' : ''}`;
  if (attr.type === 'dynamiczone') return `dynamic zone (${(attr.components ?? []).length} components)`;
  if (attr.type === 'enumeration') return `enumeration (${(attr.enum ?? []).length} values)`;
  if (attr.type === 'media') return attr.multiple ? 'media (multiple)' : 'media';
  return attr.type;
};

export const targetForContentType = (ct: ContentTypeInfo): Target => ({
  key: ctKey(ct.uid),
  kind: 'contentType',
  label: ct.displayName,
  ownerLabel: ct.uid,
  ownerUid: ct.uid,
});

export const targetForComponent = (component: ComponentInfo): Target => ({
  key: compKey(component.uid),
  kind: 'component',
  label: component.displayName,
  ownerLabel: component.uid,
  ownerUid: component.uid,
});

export const targetForField = (
  owner: ContentTypeInfo | ComponentInfo,
  ownerKey: string,
  attr: AttributeInfo
): Target => ({
  key: fieldKey(ownerKey, attr.name),
  kind: 'field',
  label: attr.name,
  ownerLabel: owner.displayName,
  ownerUid: owner.uid,
  fieldName: attr.name,
  attribute: attr,
});

const findContentType = (schema: Schema, uid: string) =>
  schema.contentTypes.find((ct) => ct.uid === uid);
const findComponent = (schema: Schema, uid: string) =>
  schema.components.find((c) => c.uid === uid);

export const findNode = (schema: Schema, parsed: ParsedKey) =>
  parsed.scope === 'ct' ? findContentType(schema, parsed.uid) : findComponent(schema, parsed.uid);

/** Rebuild a Target from a stored key, so the settings page and the Content
 *  Manager open exactly the same modal. */
export const targetFromKey = (schema: Schema, key: string): Target | null => {
  const parsed = parseKey(key);
  if (!parsed) return null;

  const node = findNode(schema, parsed);
  if (!node) return null;

  if (!parsed.field) {
    return parsed.scope === 'ct'
      ? targetForContentType(node as ContentTypeInfo)
      : targetForComponent(node as ComponentInfo);
  }

  const attr = node.attributes.find((a) => a.name === parsed.field);
  if (!attr) return null;

  return targetForField(node, `${parsed.scope}:${parsed.uid}`, attr);
};

/** Every node reachable from a content type: itself plus nested components. */
const reachableNodes = (schema: Schema, rootUid: string): Array<ContentTypeInfo | ComponentInfo> => {
  const root = findContentType(schema, rootUid);
  if (!root) return [];

  const nodes: Array<ContentTypeInfo | ComponentInfo> = [root];
  const seen = new Set<string>();
  const queue: string[] = [];

  const enqueue = (node: ContentTypeInfo | ComponentInfo) => {
    for (const attr of node.attributes) {
      if (attr.type === 'component' && attr.component) queue.push(attr.component);
      if (attr.type === 'dynamiczone') queue.push(...(attr.components ?? []));
    }
  };

  enqueue(root);
  while (queue.length) {
    const uid = queue.shift() as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const component = findComponent(schema, uid);
    if (!component) continue;
    nodes.push(component);
    enqueue(component);
  }

  return nodes;
};

const normalizeLabel = (text: string) =>
  text
    .replace(/\*$/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

/**
 * Fallback for labels whose control carries no `name` — the blocks editor, the
 * media picker and friends. The label's own text is matched against every
 * attribute reachable from this content type, and only an unambiguous hit
 * counts: two components with a `title` field resolve to nothing rather than to
 * the wrong one.
 */
export const resolveLabelText = (
  schema: Schema,
  rootUid: string,
  text: string
): Target | null => {
  const wanted = normalizeLabel(text);
  if (!wanted) return null;

  const hits: Target[] = [];

  for (const node of reachableNodes(schema, rootUid)) {
    const nodeKey = 'kind' in node ? ctKey(node.uid) : compKey(node.uid);

    for (const attr of node.attributes) {
      if (normalizeLabel(attr.name) !== wanted) continue;

      if (attr.type === 'component' && attr.component) {
        const component = findComponent(schema, attr.component);
        if (component) hits.push(targetForComponent(component));
      } else {
        hits.push(targetForField(node, nodeKey, attr));
      }
    }
  }

  const keys = new Set(hits.map((hit) => hit.key));
  return keys.size === 1 ? hits[0] : null;
};

/**
 * Turn a form field path from the Content Manager DOM ("seo.metaTitle",
 * "blocks.2.title") into the schema node it belongs to.
 *
 * Array indices carry no meaning here — the documentation is about the schema,
 * not about row 2 — so they are dropped. A dynamic zone is the one ambiguous
 * step: the path alone doesn't say which of its components a row holds, so we
 * only continue when exactly one of them can own the rest of the path, and
 * otherwise give up rather than guess.
 */
export const resolveFormPath = (schema: Schema, rootUid: string, path: string): Target | null => {
  const segments = path.split('.').filter((s) => s !== '' && !/^\d+$/.test(s));
  if (!segments.length) return null;

  let node: ContentTypeInfo | ComponentInfo | undefined = findContentType(schema, rootUid);
  let nodeKey = ctKey(rootUid);
  if (!node) return null;

  for (let i = 0; i < segments.length; i += 1) {
    const current: ContentTypeInfo | ComponentInfo | undefined = node;
    if (!current) return null;

    const name = segments[i];
    const attr: AttributeInfo | undefined = current.attributes.find((a) => a.name === name);
    if (!attr) return null;

    const isLast = i === segments.length - 1;

    if (isLast) {
      // A component-typed field points at the component itself: one description
      // for every place it is embedded.
      if (attr.type === 'component' && attr.component) {
        const component = findComponent(schema, attr.component);
        return component ? targetForComponent(component) : null;
      }
      return targetForField(current, nodeKey, attr);
    }

    if (attr.type === 'component' && attr.component) {
      const component = findComponent(schema, attr.component);
      if (!component) return null;
      node = component;
      nodeKey = compKey(attr.component);
      continue;
    }

    if (attr.type === 'dynamiczone') {
      const rest = segments.slice(i + 1);
      const candidates: ComponentInfo[] = (attr.components ?? [])
        .map((uid: string) => findComponent(schema, uid))
        .filter((c): c is ComponentInfo => !!c)
        .filter((c: ComponentInfo) => c.attributes.some((a) => a.name === rest[0]));
      if (candidates.length !== 1) return null;
      node = candidates[0];
      nodeKey = compKey(candidates[0].uid);
      continue;
    }

    return null;
  }

  return null;
};
