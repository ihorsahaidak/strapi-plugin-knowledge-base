import * as React from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import Boundary from './Boundary';
import EyeButton from './EyeButton';
import KnowledgeHost from './KnowledgeHost';
import TitleEye from './TitleEye';
import { useKnowledge } from '../store';
import { ctKey, resolveFormPath, resolveLabelText } from '../utils/keys';
import { uidFromPath } from '../utils/location';
import type { Target } from '../utils/types';

type Slot = { el: HTMLElement; target: Target };

const sameSlots = (a: Slot[], b: Slot[]) =>
  a.length === b.length && a.every((slot, i) => slot.el === b[i].el && slot.target.key === b[i].target.key);

/**
 * Form fields have no injection zone, and the design system's labels carry a
 * generated id rather than the field name, so each label is matched to its
 * field twice over: first through the control it points at (`label[for]` → the
 * element's `name`), then — for the editors that expose no named control, such
 * as blocks or media — by the label's own text. Anything still unresolved gets
 * no button, rather than a wrong one.
 */
const FieldEyes = ({ uid }: { uid: string }) => {
  const { schema } = useKnowledge();
  const [slots, setSlots] = React.useState<Slot[]>([]);

  React.useEffect(() => {
    if (!schema) return undefined;

    const main = (document.querySelector('main#main-content') ??
      document.querySelector('main')) as HTMLElement | null;
    if (!main) return undefined;

    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });

    const controlName = (label: HTMLLabelElement) => {
      const control = label.htmlFor ? document.getElementById(label.htmlFor) : null;
      return (
        control?.getAttribute('name') ??
        label.parentElement?.querySelector<HTMLElement>('[name]')?.getAttribute('name') ??
        null
      );
    };

    function scan() {
      // Our own insertions must not feed the observer back into another scan.
      observer.disconnect();

      const next: Slot[] = [];
      const skipped: string[] = [];

      main!.querySelectorAll('label').forEach((node) => {
        const label = node as HTMLLabelElement;
        const name = controlName(label);
        const text = (label.textContent ?? '').trim();

        const target =
          (name ? resolveFormPath(schema!, uid, name) : null) ??
          resolveLabelText(schema!, uid, text);

        if (!target) {
          if (text) skipped.push(text);
          return;
        }

        // The label sits in a row with its own actions — the i18n globe among
        // them — so the eye goes at the end of that row rather than straight
        // after the text, which would wedge it between the two.
        const row =
          label.parentElement && label.parentElement.firstElementChild === label
            ? label.parentElement
            : null;

        let span = (row
          ? row.querySelector(':scope > [data-kb-eye]')
          : label.nextElementSibling?.hasAttribute('data-kb-eye')
            ? label.nextElementSibling
            : null) as HTMLElement | null;

        if (!span) {
          span = document.createElement('span');
          span.setAttribute('data-kb-eye', '');
          span.style.display = 'inline-flex';
          span.style.alignItems = 'center';
          if (row) row.appendChild(span);
          else label.insertAdjacentElement('afterend', span);
        }
        next.push({ el: span, target });
      });

      // Cheap diagnosis from the browser console when a label goes unmatched.
      (window as any).__knowledgeBase = { uid, matched: next.length, skipped };

      setSlots((current) => (sameSlots(current, next) ? current : next));
      observer.observe(main!, { childList: true, subtree: true });
    }

    scan();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      main.querySelectorAll('[data-kb-eye]').forEach((el) => el.remove());
      setSlots([]);
    };
  }, [schema, uid]);

  return (
    <>
      {slots.map((slot, index) =>
        createPortal(<EyeButton target={slot.target} />, slot.el, `${slot.target.key}-${index}`)
      )}
    </>
  );
};

/**
 * Injected into `editView.right-links` — the only edit-view zone the Content
 * Manager actually renders (`editView.informations` is declared but dead in
 * Strapi 5.42). That zone hands us the content type uid as `slug`; the URL is
 * the fallback.
 */
const EditViewEyes = ({ slug }: { slug?: string }) => {
  const { pathname } = useLocation();
  const { schema } = useKnowledge();
  const uid = slug ?? uidFromPath(pathname);

  const contentType = uid ? schema?.contentTypes.find((ct) => ct.uid === uid) : undefined;

  return (
    <Boundary>
      <KnowledgeHost />
      {uid && contentType ? (
        <>
          <TitleEye
            target={{
              key: ctKey(uid),
              kind: 'contentType',
              label: contentType.displayName,
              ownerLabel: uid,
              ownerUid: uid,
            }}
          />
          <FieldEyes uid={uid} />
        </>
      ) : null}
    </Boundary>
  );
};

export default EditViewEyes;
