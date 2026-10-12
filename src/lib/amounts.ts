// Mode sembunyikan nominal (global, dari user_settings.hide_amounts).
import { rupiah, rupiahShort } from '@common/format.ts';
import { useSettings, useUpdateSettings } from '@/data/hooks';

export function useHideAmounts(): boolean {
  return useSettings().hide_amounts;
}

/** Formatter rupiah yang patuh mode sembunyikan. */
export function useMoney() {
  const hidden = useHideAmounts();
  return {
    hidden,
    rp: (n: number) => rupiah(n, hidden),
    short: (n: number) => rupiahShort(n, hidden),
  };
}

export function useToggleHideAmounts() {
  const s = useSettings();
  const m = useUpdateSettings();
  return () => m.mutate({ hide_amounts: !s.hide_amounts });
}
