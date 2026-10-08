import * as React from 'react';
import { useIntl } from 'react-intl';

import { claimHost, load, releaseHost, useKnowledge } from '../store';
import KnowledgeModal from './KnowledgeModal';

/**
 * Loads the knowledge base for the admin user's own UI language and renders the
 * modal. Several mount points include it (list view, edit view, settings), so
 * the first one to mount claims the modal and the others stay silent — without
 * this there would be one modal per injection zone.
 */
const KnowledgeHost = () => {
  const id = React.useId();
  const { locale } = useIntl();
  const { hostId, open } = useKnowledge();

  React.useEffect(() => {
    load(locale);
  }, [locale]);

  React.useEffect(() => {
    claimHost(id);
    return () => releaseHost(id);
  }, [id]);

  if (hostId !== id || !open) return null;

  return <KnowledgeModal />;
};

export default KnowledgeHost;
