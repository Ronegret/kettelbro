import type { SVGProps } from "react";

/**
 * Iconos dibujados a medida: un solo trazo (2 px, puntas redondas) sobre rejilla de 24.
 * Nada de emoji ni glifos Unicode como iconos.
 */
const PATHS = {
  card: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm5 5.2 2.8 3.8L12 15.8 9.2 12 12 8.2Z",
  chart: "M5 20V11M12 20V4M19 20v-6",
  flag: "M6 21V4m0 1c3-2 5 1.6 8 0s4-1 4-1v9s-1-.4-4 1-5-2-8 0",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0",
  x: "m6 6 12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M8 5v14M16 5v14",
  skip: "M6 5.5v13l9-6.5-9-6.5ZM18 5v14",
  info: "M12 11v6m0-9.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z",
  share: "M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm11 .5a3.5 3.5 0 0 1 0 4m2.5-6.5a7 7 0 0 1 0 9",
  mute: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm11 1 5 5m0-5-5 5",
  chevron: "m9 5 7 7-7 7",
  back: "m15 5-7 7 7 7",
  shield: "M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6l-7-3Z",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Zm0 15A1.5 1.5 0 0 0 6.5 21H19v-3",
  logout: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-4 4-4-4-4m4 4H9",
  weight: "M8 7a4 4 0 0 1 8 0M5.5 20h13l1-8.5a3 3 0 0 0-3-3.5h-8.5a3 3 0 0 0-3 3.5l.5 8.5Z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  refresh: "M4 12a8 8 0 0 1 14-5.3L20 9m0-5v5h-5m5 3a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
