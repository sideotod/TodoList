import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', async () => {
  const { createElement: createImage } = await import('react');

  return {
    default: (props: Record<string, unknown>) => createImage('img', props),
  };
});

import { TodoLogo } from '../../src/features/shell/TodoLogo';

describe('TodoLogo', () => {
  it('shows the original monochrome lockup as one accessible image at its natural ratio', () => {
    const markup = renderToStaticMarkup(createElement(TodoLogo));

    expect(markup).toContain('alt="TODO"');
    expect(markup).toContain('src="/todo-logo-separated.png"');
    expect(markup).toContain('width="1774"');
    expect(markup).toContain('height="887"');
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    expect(markup).not.toContain('TODO</span>');
  });
});
