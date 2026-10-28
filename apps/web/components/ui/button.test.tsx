import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders a native button with variant classes and merged overrides', () => {
    const html = renderToStaticMarkup(
      <Button variant="outline" className="px-6">
        Kaydet
      </Button>,
    );

    expect(html).toMatch(/^<button[^>]*type="button"/);
    expect(html).toContain('border-border');
    expect(html).toContain('px-6');
    expect(html).not.toContain('px-2.5');
  });
});
