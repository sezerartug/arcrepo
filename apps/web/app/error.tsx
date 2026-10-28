'use client';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3">
      <h1 className="text-xl font-semibold text-primary">Bir sorun oluştu</h1>
      <p className="text-sm text-muted-foreground">
        Sayfa yüklenemedi. Sunucuya ulaşılamıyor olabilir; lütfen tekrar deneyin.
      </p>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}
