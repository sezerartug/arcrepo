import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroSlider } from './hero-slider';

const tree = [
  { id: 'c1', name: 'Makine ve Ekipman', slug: 'makine-ekipman', unit: 'adet', basePerUnit: 1 },
  {
    id: 'c2',
    name: 'Hurda ve Geri Dönüşüm',
    slug: 'hurda',
    unit: 'ton',
    basePerUnit: 1,
    children: [{ id: 'c3', name: 'Proje ve İş İhaleleri', slug: 'x', unit: 'iş', basePerUnit: 1 }],
  },
];

describe('HeroSlider', () => {
  const html = renderToStaticMarkup(<HeroSlider categories={tree} />);

  it('renders an accessible carousel with seven numbered slides', () => {
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(7);
    expect(html).toContain('aria-label="1 / 7"');
    expect(html).toContain('aria-label="7 / 7"');
    expect(html).toContain('aria-live="off"');
  });

  it('shows only the first slide to assistive tech and keeps one h1', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/class="[^"]*\binvisible\b/g)).toHaveLength(6);
  });

  it('resolves category links by name (any depth) and falls back to /ilanlar', () => {
    expect(html).toContain('href="/ilanlar?categoryId=c1"');
    expect(html).toContain('href="/ilanlar?categoryId=c2"');
    expect(html).toContain('href="/ilanlar?categoryId=c3"');
    // "İş Makineleri", "El Aletleri...", "Fabrika..." are absent from the tree
    expect(html.match(/href="\/ilanlar"/g)).toHaveLength(4);
  });
});
