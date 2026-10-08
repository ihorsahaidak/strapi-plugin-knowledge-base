'use strict';

/**
 * A read-only description of the project's shape: every api:: content type,
 * every component, their attributes, and — for components — the list of places
 * they are actually used. That usage map is what makes "where is this used?"
 * answerable without anyone typing it by hand.
 */

const EXCLUDED_ATTRS = new Set(['createdBy', 'updatedBy', 'localizations']);

const displayNameOf = (schema, uid) => (schema.info && schema.info.displayName) || uid;

const describeAttribute = (name, attr) => {
  const out = { name, type: attr.type };

  if (attr.type === 'relation') {
    out.target = attr.target;
    out.relation = attr.relation;
  }
  if (attr.type === 'component') {
    out.component = attr.component;
    out.repeatable = !!attr.repeatable;
  }
  if (attr.type === 'dynamiczone') out.components = attr.components || [];
  if (attr.type === 'enumeration') out.enum = attr.enum || [];
  if (attr.type === 'media') out.multiple = !!attr.multiple;
  if (attr.required) out.required = true;
  if (attr.pluginOptions && attr.pluginOptions.i18n && attr.pluginOptions.i18n.localized === false) {
    out.localized = false;
  }

  return out;
};

const describeAttributes = (schema) =>
  Object.entries(schema.attributes || {})
    .filter(([name]) => !EXCLUDED_ATTRS.has(name))
    .map(([name, attr]) => describeAttribute(name, attr));

module.exports = ({ strapi }) => {
  const isDocumentable = (uid) => uid.startsWith('api::');

  /** uid → [{ uid, kind, field, displayName }] for every component in use. */
  const buildUsage = (contentTypes, components) => {
    const usage = {};
    const record = (componentUid, holder) => {
      if (!componentUid) return;
      (usage[componentUid] = usage[componentUid] || []).push(holder);
    };

    const walk = (holderUid, holderKind, holderName, schema) => {
      for (const [name, attr] of Object.entries(schema.attributes || {})) {
        if (attr.type === 'component') {
          record(attr.component, {
            uid: holderUid,
            kind: holderKind,
            field: name,
            displayName: holderName,
            repeatable: !!attr.repeatable,
          });
        }
        if (attr.type === 'dynamiczone') {
          for (const componentUid of attr.components || []) {
            record(componentUid, {
              uid: holderUid,
              kind: holderKind,
              field: name,
              displayName: holderName,
              dynamicZone: true,
            });
          }
        }
      }
    };

    for (const ct of contentTypes) walk(ct.uid, 'contentType', ct.displayName, strapi.contentTypes[ct.uid]);
    for (const c of components) walk(c.uid, 'component', c.displayName, strapi.components[c.uid]);

    return usage;
  };

  const getSchema = () => {
    const contentTypes = [];
    for (const [uid, ct] of Object.entries(strapi.contentTypes)) {
      if (!isDocumentable(uid)) continue;
      contentTypes.push({
        uid,
        kind: ct.kind,
        displayName: displayNameOf(ct, uid),
        description: (ct.info && ct.info.description) || '',
        localized: !!(ct.pluginOptions && ct.pluginOptions.i18n && ct.pluginOptions.i18n.localized),
        attributes: describeAttributes(ct),
      });
    }

    const components = [];
    for (const [uid, component] of Object.entries(strapi.components || {})) {
      components.push({
        uid,
        category: component.category || uid.split('.')[0],
        displayName: displayNameOf(component, uid),
        icon: (component.info && component.info.icon) || '',
        attributes: describeAttributes(component),
      });
    }

    const usage = buildUsage(contentTypes, components);
    for (const component of components) component.usedIn = usage[component.uid] || [];

    contentTypes.sort((a, b) => a.displayName.localeCompare(b.displayName));
    components.sort((a, b) => `${a.category}.${a.displayName}`.localeCompare(`${b.category}.${b.displayName}`));

    return { contentTypes, components };
  };

  return { getSchema };
};
