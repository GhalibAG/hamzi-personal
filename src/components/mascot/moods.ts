// Nilai mood persis DESIGN-SYSTEM §6.3 / Hamzi.dc.html.
import type { Mood } from '@common/lines.id.ts';

export interface MoodDef {
  r: number; sx: number; sy: number; dx: number; dy: number;
  blink: boolean; mouth: string; fill: boolean; name: string; brow?: number;
}

export const MOODS: Record<Mood, MoodDef> = {
  calm:      { r: 0,  sx: 1.5,  sy: 1.5,  dx: 0, dy: 0,  blink: true,  mouth: 'M90 116 Q95 121 100 116 Q105 121 110 116', fill: false, name: 'tenang' },
  happy:     { r: 90, sx: 1.45, sy: 1.45, dx: 0, dy: 2,  blink: false, mouth: 'M86 114 Q93 125 100 116 Q107 125 114 114', fill: false, name: 'senang' },
  excited:   { r: 0,  sx: 1.8,  sy: 1.8,  dx: 0, dy: -2, blink: true,  mouth: 'M90 115 Q100 132 110 115 Z', fill: true, name: 'bersemangat' },
  focus:     { r: 0,  sx: 1.3,  sy: 1.3,  dx: 3, dy: 3,  blink: true,  mouth: 'M94 118 L106 118', fill: false, name: 'fokus', brow: 72 },
  worried:   { r: 12, sx: 1.45, sy: 1.45, dx: 0, dy: 2,  blink: true,  mouth: 'M90 120 Q95 115 100 118 Q105 121 110 116', fill: false, name: 'khawatir', brow: 60 },
  sleepy:    { r: 0,  sx: 1.5,  sy: 0.7,  dx: 0, dy: 4,  blink: false, mouth: 'M95 118 Q100 128 105 118 Q100 112 95 118 Z', fill: true, name: 'mengantuk' },
  sleeping:  { r: 0,  sx: 1.5,  sy: 0.18, dx: 0, dy: 6,  blink: false, mouth: 'M95 117 Q100 120 105 117', fill: false, name: 'tidur' },
  celebrate: { r: 90, sx: 1.45, sy: 1.45, dx: 0, dy: 2,  blink: false, mouth: 'M88 114 Q100 134 112 114 Z', fill: true, name: 'merayakan' },
};

export const MOOD_LIST = Object.keys(MOODS) as Mood[];
