import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the product heading', () => {
    expect(renderToStaticMarkup(<HomePage />)).toContain('<h1>ARC Global</h1>');
  });
});
