import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "today"
  | "book"
  | "chart"
  | "settings"
  | "play"
  | "pause"
  | "repeat"
  | "eye"
  | "check"
  | "close"
  | "plus"
  | "trash"
  | "download"
  | "upload"
  | "arrow-left"
  | "wifi-off"
  | "sparkle";

const paths: Record<IconName, ReactNode> = {
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3" height="6" rx="1" />
      <rect x="10.5" y="7" width="3" height="10" rx="1" />
      <rect x="15.5" y="4" width="3" height="13" rx="1" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />,
  pause: (
    <>
      <rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" />
      <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 3.5 20 6.5l-3 3" />
      <path d="M4 11.5v-1a4 4 0 0 1 4-4h12" />
      <path d="M7 20.5 4 17.5l3-3" />
      <path d="M20 12.5v1a4 4 0 0 1-4 4H4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 12.5h9l1-12.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  "arrow-left": <path d="M15 5 8 12l7 7" />,
  "wifi-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M11 5.6A15 15 0 0 1 22 9.5" />
      <circle cx="12" cy="19.5" r=".8" fill="currentColor" />
    </>
  ),
  sparkle: <path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2L12 3.5Z" />,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
