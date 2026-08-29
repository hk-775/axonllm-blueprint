import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { MarkdownRenderer } from '../MarkdownRenderer';

const headingArb = fc.tuple(
  fc.constantFrom('# ', '## ', '### '),
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/),
).map(([prefix, text]) => prefix + text);

const listItemArb = fc.array(
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/),
  { minLength: 1, maxLength: 4 },
).map(items => items.map(item => `- ${item}`).join('\n'));

const codeLanguageArb = fc.constantFrom('javascript', 'python', 'typescript', 'yaml');

const codeBlockArb = fc.tuple(
  codeLanguageArb,
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_ =(){};.\n]{1,40}$/),
).map(([lang, code]) => '```' + lang + '\n' + code + '\n```');

describe('Property 11: Markdown responses are rendered with syntax-highlighted code blocks', () => {
  it('headings are rendered as semantic heading elements', () => {
    fc.assert(
      fc.property(headingArb, (md) => {
        const level = md.startsWith('### ') ? 3 : md.startsWith('## ') ? 2 : 1;
        const { container, unmount } = render(<MarkdownRenderer content={md} />);
        const heading = container.querySelector(`h${level}`);
        expect(heading).not.toBeNull();
        unmount();
      }),
      { numRuns: 100 },
    );
  });

  it('lists are rendered as ul/li elements', () => {
    fc.assert(
      fc.property(listItemArb, (md) => {
        const itemCount = md.split('\n').filter(l => l.startsWith('- ')).length;
        const { container, unmount } = render(<MarkdownRenderer content={md} />);
        const listItems = container.querySelectorAll('li');
        expect(listItems.length).toBe(itemCount);
        unmount();
      }),
      { numRuns: 100 },
    );
  });

  it('code blocks are rendered with syntax highlighting', () => {
    fc.assert(
      fc.property(codeBlockArb, (md) => {
        const { container, unmount } = render(<MarkdownRenderer content={md} />);
        const codeBlocks = container.querySelectorAll('[data-testid="code-block"]');
        expect(codeBlocks.length).toBe(1);
        // SyntaxHighlighter renders spans with class names for tokens
        const highlighted = codeBlocks[0].querySelectorAll('span');
        expect(highlighted.length).toBeGreaterThan(0);
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 12: Code blocks include a copy-to-clipboard button', () => {
  it('each code block has exactly one copy button', () => {
    const multiCodeBlockArb = fc.array(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_ ]{1,20}$/),
      { minLength: 1, maxLength: 5 },
    ).map(blocks =>
      blocks.map(b => '```js\n' + b + '\n```').join('\n\nSome text\n\n'),
    );

    fc.assert(
      fc.property(multiCodeBlockArb, (md) => {
        const expectedCount = (md.match(/```js\n/g) || []).length;
        const { unmount } = render(<MarkdownRenderer content={md} />);
        const copyButtons = screen.queryAllByLabelText('Copy code');
        expect(copyButtons.length).toBe(expectedCount);
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
