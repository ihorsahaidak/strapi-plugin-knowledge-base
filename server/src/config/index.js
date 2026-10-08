'use strict';

/**
 * Plugin config (config/plugins.js → 'knowledge-base'):
 *
 *   dataDir:       where the per-language JSON files live, relative to the
 *                  Strapi app root (or absolute). One file per admin locale.
 *   defaultLocale: language used as the fallback when an entry has not been
 *                  translated into the admin user's language.
 *   writable:      false turns the whole plugin read-only — use it in
 *                  environments with an ephemeral filesystem (containers),
 *                  where a save would be silently lost on the next deploy.
 */
module.exports = {
  default: {
    dataDir: 'src/knowledge-base',
    defaultLocale: 'en',
    writable: true,
  },
  validator(config) {
    if (config.dataDir && typeof config.dataDir !== 'string') {
      throw new Error('knowledge-base: dataDir must be a string');
    }
    if (config.defaultLocale && typeof config.defaultLocale !== 'string') {
      throw new Error('knowledge-base: defaultLocale must be a string');
    }
    if (config.writable !== undefined && typeof config.writable !== 'boolean') {
      throw new Error('knowledge-base: writable must be a boolean');
    }
  },
};
