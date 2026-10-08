import * as React from 'react';
import { styled } from 'styled-components';

import { openTarget, resolveEntry, useKnowledge } from '../store';
import type { Target } from '../utils/types';

/**
 * The 👀 button. Dim when nothing is documented yet, solid once it is, and
 * half-lit when the entry exists only in the fallback language.
 */
const Button = styled.button<{ $documented: boolean; $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0 2px;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  vertical-align: middle;
  font-size: ${({ $size }) => $size}px;
  /* Undocumented is dimmer, but still has to be visible on the dark theme. */
  opacity: ${({ $documented }) => ($documented ? 1 : 0.55)};
  filter: ${({ $documented }) => ($documented ? 'none' : 'grayscale(0.6)')};
  transition: opacity 0.15s ease;

  &:hover,
  &:focus-visible {
    opacity: 1;
    filter: none;
  }
`;

type Props = {
  target: Target;
  size?: number;
};

const EyeButton = ({ target, size = 14 }: Props) => {
  const { data } = useKnowledge();
  const { documented, translated, entry, fallback } = resolveEntry(data, target.key);

  const summary = (entry?.description || fallback?.description || '')
    .split('\n')
    .find((line) => line.trim())
    ?.replace(/^h[1-6]\.\s*/, '')
    .slice(0, 120);

  const title = documented
    ? `${summary || target.label}${translated ? '' : ` (${data?.fallbackLocale ?? 'default'} only)`}`
    : `Document "${target.label}"`;

  return (
    <Button
      type="button"
      $documented={documented}
      $size={size}
      aria-label={title}
      title={title}
      onClick={(event) => {
        // These buttons sit inside labels and table rows that have their own
        // click behaviour — none of it should fire.
        event.preventDefault();
        event.stopPropagation();
        openTarget(target);
      }}
    >
      <span role="img" aria-hidden="true">
        👀
      </span>
    </Button>
  );
};

export default EyeButton;
