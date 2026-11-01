import type { SVGProps } from "react";

/** Petites icônes SVG (trait 1,8 px, 24×24) : pas de dépendance externe. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode) {
  return function Icon({ size = 18, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const IconBell = make(
  <>
    <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </>,
);
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const IconChevronLeft = make(<path d="m15 6-6 6 6 6" />);
export const IconChevronRight = make(<path d="m9 6 6 6-6 6" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconMinus = make(<path d="M5 12h14" />);
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconRefocus = make(
  <>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    <circle cx="12" cy="12" r="2.5" />
  </>,
);
export const IconCamera = make(
  <>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
);
export const IconDownload = make(<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />);
export const IconCube = make(
  <>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </>,
);
export const IconExplode = make(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);
export const IconWire = make(
  <>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
    <path d="M12 3v18M4 7.5l16 9M20 7.5l-16 9" />
  </>,
);
export const IconSparkles = make(
  <>
    <path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.6L12 17.5l-1.8-5.4-5.7-1.6L10.2 9Z" />
    <path d="M19 15.5 19.8 18l2.2.6-2.2.7L19 21.5l-.8-2.2-2.2-.7 2.2-.6Z" />
  </>,
);
export const IconImage = make(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m20.5 16-5-5-9 8.5" />
  </>,
);
export const IconAlert = make(
  <>
    <path d="M12 4 2.8 19.5h18.4Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </>,
);
export const IconTrash = make(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />);
export const IconLogout = make(<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />);
export const IconRotate = make(
  <>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v4h-4" />
  </>,
);
export const IconGrid = make(<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const IconPin = make(
  <>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </>,
);
export const IconRuler = make(
  <>
    <path d="m3 16 13-13 5 5L8 21Z" />
    <path d="m7 12 2 2M10 9l2 2M13 6l2 2" />
  </>,
);
export const IconLayers = make(
  <>
    <path d="m12 3 9 5-9 5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </>,
);
export const IconSteps = make(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.3" />
    <circle cx="4.5" cy="12" r="1.3" />
    <circle cx="4.5" cy="18" r="1.3" />
  </>,
);
export const IconCoin = make(
  <>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </>,
);
export const IconBulb = make(
  <>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
  </>,
);
export const IconMicroscope = make(
  <>
    <path d="M6 21h12M9 17h6M12 17a5 5 0 0 0 5-5" />
    <path d="m10.5 3.5 3 1.7-3.5 6-3-1.7Z" />
    <path d="M8.5 10.5 7 13" />
    <circle cx="16.5" cy="10" r="1" />
  </>,
);
export const IconCode = make(<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />);
export const IconHistory = make(
  <>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3.5 4v4h4M12 8v4l3 2" />
  </>,
);
export const IconSettings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1" />
  </>,
);
export const IconShield = make(<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6Z" />);
export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4.3-6 8-6s7 2 8 6" />
  </>,
);

export const IconStar = make(<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />);
export const IconHeart = make(<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />);
export const IconFolder = make(<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />);
export const IconCopy = make(
  <>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </>,
);
export const IconPencil = make(<path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19Z M14.5 6.5l3 3" />);
export const IconExternal = make(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />);
export const IconRefresh = make(
  <>
    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5" />
    <path d="M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5" />
    <path d="M4 20v-4.5h4.5" />
  </>,
);

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Logo par défaut : cube isométrique en dégradé. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="f3d-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b6ee1" />
          <stop offset="1" stopColor="#c05fe0" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25Z" fill="url(#f3d-logo)" />
      <path d="M16 2.5 28 9.25 16 16 4 9.25Z" fill="#fff" fillOpacity=".35" />
      <path d="M16 16v13.5L4 22.75V9.25Z" fill="#000" fillOpacity=".12" />
    </svg>
  );
}
