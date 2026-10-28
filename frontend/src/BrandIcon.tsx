import { useId } from 'react';
const regions = {
  whatsapp: [16, 17, 124, 124],
  instagram: [149, 19, 121, 123],
  location: [279, 26, 81, 109],
  email: [47, 164, 115, 98],
  facebook: [161, 152, 123, 116],
  tiktok: [40, 264, 125, 105],
  payment: [205, 256, 157, 145],
  support: [64, 367, 137, 116],
  hombre: [402, 33, 124, 115],
  mujer: [545, 29, 110, 151],
  camisetas: [392, 178, 117, 99],
  pantalonetas: [535, 181, 130, 98],
  buzos: [394, 288, 128, 111],
  calzado: [552, 287, 164, 100],
} as const;
export type BrandIconName = keyof typeof regions;
export function BrandIcon({ name, className = '' }: { name: BrandIconName; className?: string }) {
  const [x, y, w, h] = regions[name];
  const clipId = `brand-${useId().replaceAll(':', '')}`;
  return (
    <svg
      className={`brand-icon ${className}`}
      viewBox={`${x} ${y} ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <image href="/brand-icons.png" width="769" height="536" clipPath={`url(#${clipId})`} />
    </svg>
  );
}
