// @vitest-environment jsdom
import axe from 'axe-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import RootLayout, { metadata } from './layout';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

// next/font is a compile-time transform; outside Next it only needs to return a class name.
vi.mock('next/font/google', () => ({ Geist: () => ({ variable: 'font-geist' }) }));

beforeAll(() => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <h1>ARC Global</h1>
    </RootLayout>,
  );
  const rendered = new DOMParser().parseFromString(html, 'text/html').documentElement;
  document.replaceChild(document.importNode(rendered, true), document.documentElement);

  // Next renders <title> from `metadata`; a plain render does not.
  if (typeof metadata.title !== 'string') throw new Error('metadata.title must be a string');
  document.title = metadata.title;
});

describe('RootLayout', () => {
  it('declares Turkish as the page language', () => {
    expect(document.documentElement.lang).toBe('tr');
  });

  it('renders a skip link to the main landmark', () => {
    const skip = document.querySelector('a[href="#main-content"]');
    expect(skip?.textContent).toBe('İçeriğe geç');
    expect(document.querySelector('main#main-content')).not.toBeNull();
  });

  it('renders header and footer landmarks with a home link', () => {
    expect(document.querySelector('header a[href="/"]')?.textContent).toBe('ARC Global');
    expect(document.querySelector('footer')).not.toBeNull();
  });

  it('has no axe accessibility violations', async () => {
    const { violations } = await axe.run(document);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
