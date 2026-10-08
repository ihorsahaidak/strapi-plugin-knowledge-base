'use strict';

/**
 * Two admin permissions, both assignable from Settings → Roles:
 *   plugin::knowledge-base.read    — see the 👀 buttons and the settings page
 *   plugin::knowledge-base.update  — write the JSON files
 *
 * Reading is not gated by `read` at the route level (every authenticated admin
 * may look things up); the action exists so a role can be pointed at the
 * settings page. Writing is gated.
 */
module.exports = ({ strapi }) => {
  const actionProvider = strapi.service('admin::permission')?.actionProvider;
  if (!actionProvider) return;

  actionProvider.registerMany([
    {
      section: 'plugins',
      displayName: 'Read documentation',
      uid: 'read',
      pluginName: 'knowledge-base',
    },
    {
      section: 'plugins',
      displayName: 'Edit documentation',
      uid: 'update',
      pluginName: 'knowledge-base',
    },
  ]);
};
