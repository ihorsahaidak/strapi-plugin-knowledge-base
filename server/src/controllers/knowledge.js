'use strict';

const svc = (strapi, name) => strapi.plugin('knowledge-base').service(name);

const canEdit = (ctx) => {
  try {
    return !!ctx.state.userAbility && ctx.state.userAbility.can('plugin::knowledge-base.update');
  } catch {
    return false;
  }
};

module.exports = ({ strapi }) => ({
  // GET /knowledge-base/schema -> { contentTypes, components }
  async schema(ctx) {
    ctx.body = svc(strapi, 'schema').getSchema();
  },

  /**
   * GET /knowledge-base/entries?locale=fr
   *
   * Returns the requested language plus the default one, so the admin can show
   * "not translated yet — here is the English text" without a second call.
   */
  async entries(ctx) {
    const store = svc(strapi, 'store');
    const locale = store.normalizeLocale(ctx.query.locale);
    const fallbackLocale = store.defaultLocale();

    const [entries, locales, writable] = await Promise.all([
      store.read(locale),
      store.listLocales(),
      store.isWritable(),
    ]);

    ctx.body = {
      locale,
      fallbackLocale,
      locales,
      entries,
      fallback: locale === fallbackLocale ? {} : await store.read(fallbackLocale),
      canEdit: canEdit(ctx),
      writable,
      dataDir: store.dataDir(),
    };
  },

  // PUT /knowledge-base/entries  { locale, key, entry }
  async upsert(ctx) {
    const store = svc(strapi, 'store');
    const { locale, key, entry } = ctx.request.body || {};

    if (!store.isValidKey(key)) return ctx.badRequest('invalid key');
    if (!(await store.isWritable())) return ctx.forbidden('knowledge base is read-only');

    try {
      const saved = await store.upsert(locale, key, entry, ctx.state.user && ctx.state.user.email);
      ctx.body = { key, locale: store.normalizeLocale(locale), entry: saved };
    } catch (error) {
      strapi.log.error(`[knowledge-base] save failed for ${key}: ${error.message}`);
      ctx.throw(500, 'could not write the knowledge base file');
    }
  },

  // POST /knowledge-base/entries/delete  { locale, key }
  async remove(ctx) {
    const store = svc(strapi, 'store');
    const { locale, key } = ctx.request.body || {};

    if (!store.isValidKey(key)) return ctx.badRequest('invalid key');
    if (!(await store.isWritable())) return ctx.forbidden('knowledge base is read-only');

    try {
      ctx.body = { key, locale: store.normalizeLocale(locale), deleted: await store.remove(locale, key) };
    } catch (error) {
      strapi.log.error(`[knowledge-base] delete failed for ${key}: ${error.message}`);
      ctx.throw(500, 'could not write the knowledge base file');
    }
  },
});
