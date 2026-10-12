// Pembungkus Switch bersama: knob absolut di dalam <button> mewarisi text-align:center sehingga posisi statisnya bergeser
// ke tengah track. `text-left` pada tombol mengembalikan knob ke kiri. (Usulan perbaikan bersama: tambah `left-0` pada knob.)
import { Switch } from '@/components/ui';

export function ToggleSwitch(props: Parameters<typeof Switch>[0]) {
  return (
    <span className="flex shrink-0 [&>button]:text-left">
      <Switch {...props} />
    </span>
  );
}
