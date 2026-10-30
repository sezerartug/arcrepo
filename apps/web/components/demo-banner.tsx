import { isDemoMode } from '@/lib/demo/mock-api';
import { DemoRoleSwitch } from './demo-role-switch';

/** Demo build only: explains the mode and lets visitors switch role without a password. */
export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="bg-brand text-brand-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <p className="font-medium">Demo sürümü — örnek veriler; işlemler kaydedilmez.</p>
        <DemoRoleSwitch />
      </div>
    </div>
  );
}
