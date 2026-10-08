import * as React from 'react';
import { Box, Typography } from '@strapi/design-system';

/**
 * A small Textile renderer, matching the subset Redmine's wiki syntax uses.
 *
 * It builds React elements directly — no HTML string is ever produced — so a
 * description written by one admin cannot inject markup into another admin's
 * page. Redmine's own linking macros (`#123`, `[[Wiki page]]`, `commit:…`) mean
 * nothing outside Redmine and are left as plain text.
 */

const isSafeHref = (href: string) => /^(https?:\/\/|mailto:|\/)/i.test(href);
const isWordChar = (char: string | undefined) => !!char && /[A-Za-z0-9]/.test(char);

const CODE_STYLE: React.CSSProperties = {
  background: 'rgba(0,0,0,0.06)',
  borderRadius: 4,
  padding: '0 4px',
  fontFamily: 'monospace',
  fontSize: '0.9em',
};

type Wrapper = (text: string, key: string) => React.ReactNode;

/** Phrase modifiers, in the order Textile resolves them. */
const PHRASES: Array<{ re: RegExp; wrap: Wrapper; boundary: boolean }> = [
  { re: /^\*([^*\n]+)\*/, wrap: (t, k) => <strong key={k}>{t}</strong>, boundary: true },
  { re: /^_([^_\n]+)_/, wrap: (t, k) => <em key={k}>{t}</em>, boundary: true },
  { re: /^\+([^+\n]+)\+/, wrap: (t, k) => <u key={k}>{t}</u>, boundary: true },
  { re: /^-([^-\n]+)-/, wrap: (t, k) => <s key={k}>{t}</s>, boundary: true },
  { re: /^@([^@\n]+)@/, wrap: (t, k) => <code key={k} style={CODE_STYLE}>{t}</code>, boundary: false },
];

// "label":http://example.com — Redmine's link syntax.
const NAMED_LINK = /^"([^"\n]+)":((?:https?:\/\/|mailto:|\/)[^\s)]+)/;
const BARE_LINK = /^(https?:\/\/[^\s)]+)/;

const link = (href: string, label: string, key: string) =>
  isSafeHref(href) ? (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : (
    <span key={key}>{label}</span>
  );

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let buffer = '';
  let index = 0;
  let token = 0;

  const flush = () => {
    if (!buffer) return;
    out.push(<React.Fragment key={`${keyPrefix}-t${token++}`}>{buffer}</React.Fragment>);
    buffer = '';
  };

  while (index < text.length) {
    const rest = text.slice(index);
    const previous = index === 0 ? undefined : text[index - 1];
    let consumed = 0;

    const named = NAMED_LINK.exec(rest);
    const bare = !named && !isWordChar(previous) ? BARE_LINK.exec(rest) : null;

    if (named) {
      flush();
      out.push(link(named[2], named[1], `${keyPrefix}-l${token++}`));
      consumed = named[0].length;
    } else if (bare) {
      flush();
      out.push(link(bare[1], bare[1], `${keyPrefix}-l${token++}`));
      consumed = bare[0].length;
    } else {
      for (const phrase of PHRASES) {
        // Textile only opens a modifier at a word boundary, which is what keeps
        // `well-known` and `snake_case_name` from turning into markup.
        if (phrase.boundary && isWordChar(previous)) continue;

        const match = phrase.re.exec(rest);
        if (!match) continue;
        if (phrase.boundary && isWordChar(rest[match[0].length])) continue;

        flush();
        out.push(phrase.wrap(match[1], `${keyPrefix}-p${token++}`));
        consumed = match[0].length;
        break;
      }
    }

    if (consumed) {
      index += consumed;
    } else {
      buffer += text[index];
      index += 1;
    }
  }

  flush();
  return out;
};

type Block =
  | { type: 'p'; lines: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: Array<{ depth: number; text: string }> }
  | { type: 'code'; lines: string[] }
  | { type: 'table'; rows: Array<{ header: boolean; cells: string[] }> }
  | { type: 'hr' };

const LIST = /^(\*{1,3}|#{1,3})\s+(.*)$/;
const HEADING = /^h([1-6])\.\s+(.*)$/;
const TABLE_ROW = /^\|(.+)\|\s*$/;

const parseRow = (line: string) => {
  const cells = line
    .replace(TABLE_ROW, '$1')
    .split('|')
    .map((cell) => cell.trim());
  const header = cells.every((cell) => cell.startsWith('_.'));
  return { header, cells: cells.map((cell) => cell.replace(/^_\.\s*/, '')) };
};

const toBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let code: Block | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Textile code blocks are <pre> tags; Redmine also allows a nested <code>.
    if (/^<pre>/i.test(line.trim())) {
      code = { type: 'code', lines: [] };
      const inline = line.trim().replace(/^<pre>\s*(<code[^>]*>)?/i, '');
      if (inline) (code as { lines: string[] }).lines.push(inline);
      continue;
    }
    if (code) {
      if (/<\/pre>/i.test(line)) {
        const tail = line.replace(/(<\/code>)?\s*<\/pre>.*/i, '');
        if (tail) (code as { lines: string[] }).lines.push(tail);
        blocks.push(code);
        code = null;
      } else {
        (code as { lines: string[] }).lines.push(raw);
      }
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: Number(heading[1]), text: heading[2] });
      continue;
    }

    const last = blocks[blocks.length - 1];

    if (TABLE_ROW.test(line)) {
      const row = parseRow(line);
      if (last && last.type === 'table') last.rows.push(row);
      else blocks.push({ type: 'table', rows: [row] });
      continue;
    }

    const list = LIST.exec(line);
    if (list) {
      const ordered = list[1].startsWith('#');
      const item = { depth: list[1].length - 1, text: list[2] };
      if (last && last.type === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ type: 'list', ordered, items: [item] });
      continue;
    }

    const quote = /^(?:bq\.\s+|>\s?)(.*)$/.exec(line);
    if (quote) {
      if (last && last.type === 'quote') last.lines.push(quote[1]);
      else blocks.push({ type: 'quote', lines: [quote[1]] });
      continue;
    }

    if (!line.trim()) continue;

    // `p. ` is Textile's explicit paragraph marker.
    const body = line.replace(/^p\.\s+/, '');
    if (last && last.type === 'p') last.lines.push(body);
    else blocks.push({ type: 'p', lines: [body] });
  }

  if (code) blocks.push(code);
  return blocks;
};

const paragraph = (lines: string[], keyPrefix: string) =>
  lines.map((line, index) => (
    <React.Fragment key={`${keyPrefix}-l${index}`}>
      {index > 0 ? <br /> : null}
      {renderInline(line, `${keyPrefix}-l${index}`)}
    </React.Fragment>
  ));

const listItems = (
  items: Array<{ depth: number; text: string }>,
  ordered: boolean,
  keyPrefix: string
) => {
  // One level of nesting is enough for a field description; anything deeper is
  // flattened onto it rather than dropped.
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];

    if (item.depth === 0) {
      const children: Array<{ depth: number; text: string }> = [];
      let next = index + 1;
      while (next < items.length && items[next].depth > 0) {
        children.push(items[next]);
        next += 1;
      }

      nodes.push(
        <li key={`${keyPrefix}-i${index}`}>
          <Typography textColor="neutral800">{renderInline(item.text, `${keyPrefix}-i${index}`)}</Typography>
          {children.length ? (
            <Box paddingLeft={4}>
              {React.createElement(
                ordered ? 'ol' : 'ul',
                { style: { listStyle: ordered ? 'lower-alpha' : 'circle', margin: 0 } },
                children.map((child, childIndex) => (
                  <li key={`${keyPrefix}-i${index}-c${childIndex}`}>
                    <Typography textColor="neutral800">
                      {renderInline(child.text, `${keyPrefix}-i${index}-c${childIndex}`)}
                    </Typography>
                  </li>
                ))
              )}
            </Box>
          ) : null}
        </li>
      );

      index = next;
    } else {
      nodes.push(
        <li key={`${keyPrefix}-i${index}`}>
          <Typography textColor="neutral800">{renderInline(item.text, `${keyPrefix}-i${index}`)}</Typography>
        </li>
      );
      index += 1;
    }
  }

  return nodes;
};

export const Textile = ({ text }: { text?: string | null }) => {
  if (!text || !text.trim()) return null;

  return (
    <Box>
      {toBlocks(text).map((block, index) => {
        const key = `b${index}`;

        if (block.type === 'heading') {
          return (
            <Box key={key} paddingTop={index ? 3 : 0} paddingBottom={1}>
              <Typography variant={(block.level <= 2 ? 'delta' : 'sigma') as any} fontWeight="bold">
                {renderInline(block.text, key)}
              </Typography>
            </Box>
          );
        }

        if (block.type === 'code') {
          return (
            <Box key={key} padding={3} marginTop={2} hasRadius background="neutral100">
              <Typography variant="pi">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {block.lines.join('\n')}
                </pre>
              </Typography>
            </Box>
          );
        }

        if (block.type === 'hr') {
          return (
            <Box key={key} paddingTop={2} paddingBottom={2}>
              <hr style={{ border: 0, borderTop: '1px solid rgba(0,0,0,0.12)' }} />
            </Box>
          );
        }

        if (block.type === 'table') {
          return (
            <Box key={key} paddingTop={index ? 2 : 0} style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-r${rowIndex}`}>
                      {row.cells.map((cell, cellIndex) => {
                        const Cell = row.header ? 'th' : 'td';
                        return (
                          <Cell
                            key={`${key}-r${rowIndex}-c${cellIndex}`}
                            style={{
                              border: '1px solid rgba(0,0,0,0.12)',
                              padding: '4px 8px',
                              textAlign: 'left',
                            }}
                          >
                            <Typography variant="pi" fontWeight={row.header ? 'bold' : undefined}>
                              {renderInline(cell, `${key}-r${rowIndex}-c${cellIndex}`)}
                            </Typography>
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          );
        }

        if (block.type === 'list') {
          return (
            <Box key={key} paddingTop={index ? 2 : 0} paddingLeft={4}>
              {React.createElement(
                block.ordered ? 'ol' : 'ul',
                { style: { listStyle: block.ordered ? 'decimal' : 'disc', margin: 0 } },
                listItems(block.items, block.ordered, key)
              )}
            </Box>
          );
        }

        if (block.type === 'quote') {
          return (
            <Box
              key={key}
              marginTop={2}
              paddingLeft={3}
              style={{ borderLeft: '3px solid rgba(0,0,0,0.12)' }}
            >
              <Typography textColor="neutral600">
                <em>{paragraph(block.lines, key)}</em>
              </Typography>
            </Box>
          );
        }

        return (
          <Box key={key} paddingTop={index ? 2 : 0}>
            <Typography textColor="neutral800">{paragraph(block.lines, key)}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default Textile;
