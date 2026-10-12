import { Icon } from '@/components/icons';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;

/** Keypad nominal (DESIGN-SYSTEM §5): grid 3, tombol 52, radius 16. Mengubah string digit. */
export function Keypad({ value, onChange, maxLen = 10 }: { value: string; onChange: (v: string) => void; maxLen?: number }) {
  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    const next = (value + k).replace(/^0+/, '').slice(0, maxLen);
    onChange(next);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === 'del' ? 'Hapus' : k}
          onClick={() => press(k)}
          className="flex h-13 items-center justify-center rounded-xl bg-surface-2 text-h2 font-bold text-ink active:bg-line"
        >
          {k === 'del' ? <Icon.Backspace size={24} /> : k}
        </button>
      ))}
    </div>
  );
}
