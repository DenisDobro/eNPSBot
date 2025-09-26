import type { JSX } from 'react';

export type IconProps = { className?: string };

export function SunIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v2.2m0 12.6v2.2m8.5-8.5h-2.2M5.7 12H3.5m13.02 6.02-1.56-1.56M8.54 8.54 6.98 6.98m0 10.04 1.56-1.56m8.96-8.96-1.56 1.56"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <path
        d="M21 12.8A8.6 8.6 0 0 1 11.2 3a7.4 7.4 0 1 0 9.8 9.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ProfileIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.2 19.5a6.5 6.5 0 1 1 11.6 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ExternalLinkIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <path
        d="M13.5 5.5h5v5m-9 8h-4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="m12 12 6.2-6.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <circle cx="9" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M13 15h8m-4 0v3m0-3v-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
