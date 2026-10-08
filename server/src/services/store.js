'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

/**
 * The knowledge base on disk: `<dataDir>/<locale>.json`, one file per admin
 * language, written back in a stable, sorted, pretty-printed shape so a change
 * made in the admin shows up as a readable diff in the project's repository.
 *
 * Nothing here touches the project's database.
 */

const LOCALE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const KEY_RE = /^(ct|comp):[^\s]{1,200}$/;
const MAX_TEXT = 20000;

const clean = (value, max = 500) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';

/**
 * An entry is one Markdown description. Only that survives a save — anything
 * else a client sends is dropped, and an empty description means "delete".
 */
const sanitizeEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const description = clean(raw.description, MAX_TEXT);
  return description ? { description } : null;
};

const sortedEntries = (entries) => {
  const out = {};
  for (const key of Object.keys(entries).sort()) out[key] = entries[key];
  return out;
};

module.exports = ({ strapi }) => {
  const config = () => strapi.config.get('plugin::knowledge-base', {});

  const defaultLocale = () => config().defaultLocale || 'en';

  const dataDir = () => {
    const configured = config().dataDir || 'src/knowledge-base';
    return path.isAbsolute(configured)
      ? configured
      : path.join(strapi.dirs.app.root, configured);
  };

  const fileFor = (locale) => path.join(dataDir(), `${normalizeLocale(locale)}.json`);

  const normalizeLocale = (locale) => {
    const value = typeof locale === 'string' ? locale.trim() : '';
    return LOCALE_RE.test(value) ? value : defaultLocale();
  };

  const isValidKey = (key) => typeof key === 'string' && KEY_RE.test(key);

  /** Every language we know about: configured admin locales plus files present. */
  const listLocales = async () => {
    const configured = strapi.config.get('admin.config.locales', []) || [];
    const found = [];
    try {
      for (const name of await fsp.readdir(dataDir())) {
        if (name.endsWith('.json')) found.push(name.slice(0, -5));
      }
    } catch {
      /* directory does not exist yet */
    }
    return [...new Set([defaultLocale(), ...configured, ...found])].filter((l) => LOCALE_RE.test(l));
  };

  const read = async (locale) => {
    try {
      const raw = await fsp.readFile(fileFor(locale), 'utf8');
      const parsed = JSON.parse(raw);
      const entries = parsed && typeof parsed.entries === 'object' && parsed.entries ? parsed.entries : {};
      return entries;
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      strapi.log.warn(`[knowledge-base] could not read ${fileFor(locale)}: ${error.message}`);
      return {};
    }
  };

  const write = async (locale, entries) => {
    const file = fileFor(locale);
    const payload = {
      locale: normalizeLocale(locale),
      updatedAt: new Date().toISOString(),
      entries: sortedEntries(entries),
    };

    await fsp.mkdir(path.dirname(file), { recursive: true });
    // Rename over the target so a crash mid-write can't leave a half file.
    const tmp = `${file}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fsp.rename(tmp, file);
  };

  /**
   * False when the plugin is configured read-only or the directory can't be
   * written. The directory usually does not exist before the first save, so
   * what actually gets tested is its nearest existing ancestor — that is what
   * `mkdir -p` will need.
   */
  const isWritable = async () => {
    if (config().writable === false) return false;

    let dir = dataDir();
    for (;;) {
      try {
        await fsp.access(dir, fs.constants.W_OK);
        return true;
      } catch (error) {
        if (error.code !== 'ENOENT') return false;
        const parent = path.dirname(dir);
        if (parent === dir) return false;
        dir = parent;
      }
    }
  };

  const upsert = async (locale, key, rawEntry, author) => {
    if (!isValidKey(key)) throw new Error('invalid key');

    const entries = await read(locale);
    const entry = sanitizeEntry(rawEntry);

    if (!entry) {
      // An entry saved empty is a deletion: no blank rows in the file.
      delete entries[key];
    } else {
      // Stamped server-side so the file records who last touched it even where
      // the deployment is not the repository someone can run `git blame` on.
      entry.updatedAt = new Date().toISOString();
      if (author) entry.updatedBy = clean(author, 120);
      entries[key] = entry;
    }

    await write(locale, entries);
    return entry;
  };

  const remove = async (locale, key) => {
    if (!isValidKey(key)) throw new Error('invalid key');
    const entries = await read(locale);
    if (!(key in entries)) return false;
    delete entries[key];
    await write(locale, entries);
    return true;
  };

  return {
    read,
    upsert,
    remove,
    listLocales,
    isWritable,
    normalizeLocale,
    isValidKey,
    defaultLocale,
    dataDir,
  };
};
