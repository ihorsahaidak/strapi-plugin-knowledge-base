'use strict';

const canEdit = {
  name: 'admin::hasPermissions',
  config: { actions: ['plugin::knowledge-base.update'] },
};

/**
 * Admin-type routes: mounted under `/knowledge-base` and authenticated with the
 * same session the Content Manager uses. Reads are open to any admin user,
 * writes need the plugin's `update` permission.
 */
module.exports = {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/schema', handler: 'knowledge.schema', config: { policies: [] } },
      { method: 'GET', path: '/entries', handler: 'knowledge.entries', config: { policies: [] } },
      {
        method: 'PUT',
        path: '/entries',
        handler: 'knowledge.upsert',
        config: { policies: [canEdit] },
      },
      {
        method: 'POST',
        path: '/entries/delete',
        handler: 'knowledge.remove',
        config: { policies: [canEdit] },
      },
    ],
  },
};
