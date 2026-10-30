import type { ReactNode } from 'react';
import { PageTitle } from '@/components/common';

export type DocSection = { heading: string; body?: string[]; list?: string[] };

/** Long-form text page (legal and corporate): numbered headings, paragraphs, bullet lists. */
export function DocPage({
  title,
  sub,
  updated,
  sections,
  children,
}: {
  title: string;
  sub?: string;
  updated?: string;
  sections: DocSection[];
  children?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <PageTitle sub={sub}>{title}</PageTitle>
      {updated ? (
        <p className="-mt-3 mb-6 text-xs text-muted-foreground">Son güncelleme: {updated}</p>
      ) : null}
      <div className="space-y-7">
        {sections.map((s, i) => (
          <section key={s.heading} aria-labelledby={`s${String(i + 1)}`}>
            <h2 id={`s${String(i + 1)}`} className="mb-2 text-lg font-semibold text-primary">
              {i + 1}. {s.heading}
            </h2>
            {s.body?.map((p) => (
              <p key={p} className="mb-2 text-sm leading-relaxed">
                {p}
              </p>
            ))}
            {s.list ? (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      {children}
    </article>
  );
}
