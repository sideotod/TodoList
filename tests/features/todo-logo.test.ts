import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { TodoLogo } from '../../src/features/shell/TodoLogo';

describe('TodoLogo', () => {
  it('shows the accessible v4 checkbox wordmark', () => {
    const markup = renderToStaticMarkup(createElement(TodoLogo));

    expect(markup).toContain('aria-label="todo"');
    expect(markup).toContain('data-testid="todo-logo"');
    expect(markup).toContain('data-variant="sidebar"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('✓</span>');
    expect(markup).toContain('>todo</span>');
    expect(markup).not.toContain('<img');
  });

  it('supports the compact title-bar treatment', () => {
    const markup = renderToStaticMarkup(createElement(TodoLogo, { variant: 'title' }));

    expect(markup).toContain('data-variant="title"');
    expect(markup).toContain('data-testid="todo-title-logo"');
  });
});
