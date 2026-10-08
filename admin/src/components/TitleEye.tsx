import * as React from 'react';
import { createPortal } from 'react-dom';

import EyeButton from './EyeButton';
import type { Target } from '../utils/types';

/**
 * The Content Manager offers no injection zone next to the page title, so the
 * eye is portalled into the <h1> itself: an invisible marker tells us which
 * <main> we are in, we append one span to its heading and render into it.
 */
const TitleEye = ({ target }: { target: Target }) => {
  const markerRef = React.useRef<HTMLSpanElement>(null);
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const marker = markerRef.current;
    if (!marker) return undefined;

    const main = marker.closest('main#main-content') ?? marker.closest('main') ?? document.querySelector('main');
    const heading = main?.querySelector('h1');
    if (!heading) return undefined;

    const span = document.createElement('span');
    span.setAttribute('data-kb-title-eye', '');
    span.style.marginInlineStart = '8px';
    heading.appendChild(span);
    setHost(span);

    return () => {
      span.remove();
      setHost(null);
    };
  }, [target.key]);

  return (
    <>
      <span ref={markerRef} style={{ display: 'none' }} aria-hidden="true" />
      {host ? createPortal(<EyeButton target={target} size={16} />, host) : null}
    </>
  );
};

export default TitleEye;
