import * as React from 'react';
import { useLocation } from 'react-router-dom';

import Boundary from './Boundary';
import KnowledgeHost from './KnowledgeHost';
import TitleEye from './TitleEye';
import { useKnowledge } from '../store';
import { ctKey } from '../utils/keys';
import { uidFromPath } from '../utils/location';

/** Injected once per list view (content-manager `listView.actions`). */
const ListViewEye = () => {
  const { pathname } = useLocation();
  const { schema } = useKnowledge();
  const uid = uidFromPath(pathname);
  const contentType = uid ? schema?.contentTypes.find((ct) => ct.uid === uid) : undefined;

  return (
    <Boundary>
      <KnowledgeHost />
      {uid && contentType ? (
        <TitleEye
          target={{
            key: ctKey(uid),
            kind: 'contentType',
            label: contentType.displayName,
            ownerLabel: uid,
            ownerUid: uid,
          }}
        />
      ) : null}
    </Boundary>
  );
};

export default ListViewEye;
