import pluginId from './pluginId';
import EditViewEyes from './components/EditViewEyes';
import ListViewEye from './components/ListViewEye';

export default {
  register(app: any) {
    // Settings → Knowledge Base
    app.createSettingSection(
      {
        id: pluginId,
        intlLabel: { id: `${pluginId}.settings.section`, defaultMessage: 'Knowledge Base' },
      },
      [
        {
          intlLabel: { id: `${pluginId}.settings.base`, defaultMessage: 'Knowledge base' },
          id: `${pluginId}-base`,
          to: `${pluginId}/base`,
          Component: () => import('./pages/Settings'),
        },
      ]
    );
  },

  bootstrap(app: any) {
    const cm = app.getPlugin('content-manager');
    if (!cm) return;

    // `right-links` is the only edit-view zone the Content Manager renders
    // (`informations` is declared in its zone map but never mounted). The
    // component itself draws nothing there — it portals the 👀 buttons onto the
    // title and the form labels, and hosts the modal.
    cm.injectComponent('editView', 'right-links', {
      name: `${pluginId}-edit-eyes`,
      Component: EditViewEyes,
    });

    cm.injectComponent('listView', 'actions', {
      name: `${pluginId}-list-eye`,
      Component: ListViewEye,
    });
  },
};
