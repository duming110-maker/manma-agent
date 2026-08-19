/**
 * Inline SVG icon set for the P2-a shell skeleton — a visual port of the
 * subset the sidebar consumes from the frontend-user demo (reference/demo/
 * frontend-user/src/components/icons.tsx, read-only source; structure ported,
 * never imported). Line style with `currentColor` so icons follow the
 * skeleton's `--bc-text-*` tokens.
 */

/** Icon component props (frontend-user parity: 16px default, optional class). */
interface IconProps {
  /** Rendered square size in px. */
  size?: number
  /** Extra class name for the svg element. */
  className?: string
}

/** New-task icon (square + pen) — the first sidebar row. */
export function NewTaskIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M11 1.99882C11.5522 1.99882 11.9999 2.44659 12 2.99882C12 3.5511 11.5523 3.99882 11 3.99882C9.58364 3.99882 8.58138 3.99928 7.79785 4.06327C7.02597 4.12634 6.5539 4.2457 6.18359 4.43436C5.43112 4.81782 4.81902 5.42995 4.43555 6.18241C4.24687 6.5527 4.12752 7.02482 4.06445 7.79667C4.00047 8.58018 4 9.58251 4 10.9988V11.9988C4 13.8959 4.00112 15.2389 4.11328 16.2742C4.22343 17.2906 4.43078 17.8922 4.76367 18.3504C5.01032 18.6898 5.309 18.9885 5.64844 19.2351C6.10667 19.5681 6.70818 19.7754 7.72461 19.8855C8.75997 19.9977 10.1029 19.9988 12 19.9988H13C14.4164 19.9988 15.4186 19.9984 16.2021 19.9344C16.9741 19.8713 17.4461 19.752 17.8164 19.5633C18.5689 19.1798 19.181 18.5677 19.5645 17.8152C19.7531 17.4449 19.8725 16.9728 19.9355 16.201C19.9995 15.4175 20 14.4151 20 12.9988C20.0001 12.4466 20.4478 11.9988 21 11.9988C21.5522 11.9988 21.9999 12.4466 22 12.9988C22 14.3823 22.0009 15.4802 21.9287 16.3641C21.8555 17.2596 21.7019 18.0233 21.3457 18.7225C20.7705 19.8514 19.8526 20.7693 18.7236 21.3445C18.0244 21.7008 17.260 21.8544 16.3652 21.9275C15.4813 21.9997 14.3835 21.9988 13 21.9988H12C10.1475 21.9988 8.67782 22.0003 7.50977 21.8738C6.32316 21.7453 5.32958 21.475 4.47363 20.8533C3.96429 20.4832 3.51557 20.0345 3.14551 19.5252C2.52381 18.6693 2.25356 17.6756 2.125 16.4891C1.99848 15.321 2 13.8512 2 11.9988V10.9988C2 9.61535 1.99909 8.51745 2.07129 7.63358C2.14446 6.73808 2.29807 5.97437 2.6543 5.27518C3.22954 4.14626 4.14743 3.22834 5.27637 2.65311C5.97557 2.29689 6.73923 2.14327 7.63477 2.07011C8.51866 1.9979 9.61648 1.99882 11 1.99882ZM17.0459 2.70683C18.2174 1.53524 20.1174 1.53521 21.2891 2.70683C22.4598 3.87818 22.4598 5.77752 21.2891 6.94901L13.8271 14.4139C13.482 14.7592 13.2298 15.0167 12.9346 15.2254C12.6866 15.4005 12.4187 15.5472 12.1377 15.6619C11.8029 15.7986 11.4497 15.8732 10.9727 15.9783L9.9375 16.2068C9.75332 16.2474 9.54843 16.293 9.37305 16.3152C9.19723 16.3375 8.9042 16.3588 8.59375 16.2332C8.21725 16.0804 7.91905 15.7815 7.7666 15.4051C7.64121 15.0951 7.66139 14.8026 7.68359 14.6267C7.70579 14.4513 7.75139 14.2456 7.79199 14.0613L8.02149 13.0242C8.12639 12.5482 8.20065 12.1964 8.33692 11.8621C8.45152 11.5812 8.59848 11.3131 8.77344 11.0652C8.98179 10.7702 9.23812 10.5177 9.58301 10.1726L17.0459 2.70683ZM19.875 4.12089C19.4844 3.73029 18.8505 3.73117 18.46 4.12186L10.9971 11.5867C10.6059 11.9781 10.4944 12.0952 10.4072 12.2185C10.3199 12.3423 10.2457 12.4757 10.1885 12.616C10.1314 12.756 10.0939 12.9138 9.97461 13.4549L9.8125 14.1853L10.542 14.0252C11.084 13.9057 11.241 13.8666 11.3818 13.8094C11.522 13.752 11.6564 13.68 11.7803 13.5926C11.903 13.5053 12.0203 13.3928 12.4121 13.0008L19.875 5.53495C20.2649 5.14455 20.2648 4.5113 19.875 4.12089Z" />
    </svg>
  )
}

/** Skills icon (open book) — the skills nav placeholder row. */
export function SkillsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g clipPath="url(#bc-clip-skills)">
        <path d="M11.6611 12.7705H8.9375V11.917H11.6611V12.7705ZM4.87598 2.62695C5.52882 2.62709 6.11259 2.92328 6.5 3.38867C6.8875 2.92287 7.47271 2.62695 8.12598 2.62695H12.4053V7.36035H11.4297V3.60156H8.12598C7.49782 3.60156 6.9884 4.11113 6.98828 4.73926V10.5439C7.10856 10.4669 7.23685 10.4013 7.37207 10.3496L7.82715 10.1748L8.1748 11.0859L7.71973 11.2598C7.2913 11.4235 6.98851 11.838 6.98828 12.3223H6.0127L6.00684 12.207C5.94869 11.6335 5.4648 11.1858 4.87598 11.1855H0.59668V2.62695H4.87598ZM12.917 10.874H8.9375V10.0205H12.917V10.874ZM1.57129 10.21H4.87598C5.29481 10.21 5.68437 10.3336 6.0127 10.5439V4.73926C6.01258 4.11128 5.50392 3.6018 4.87598 3.60156H1.57129V10.21ZM12.917 8.97852H8.9375V8.125H12.917V8.97852Z" />
      </g>
      <defs>
        <clipPath id="bc-clip-skills">
          <path d="M0 0H13V13H0z" />
        </clipPath>
      </defs>
    </svg>
  )
}

/** Cron icon (alarm clock) — the cron nav placeholder row. */
export function CronIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M5.5 3.5l-3 3" />
      <path d="M18.5 3.5l3 3" />
      <path d="M6 1h12" />
    </svg>
  )
}

/** Settings icon (gear) — the settings nav placeholder row. */
export function SettingsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

/** User icon — the bottom user-area placeholder avatar. */
export function UserIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/** Sun icon — shown while dark is active (switch back to light). */
export function SunIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

/** Moon icon — shown while light is active (switch to dark). */
export function MoonIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/** Archive icon (box into a tray) — the session row's hover archive action (D13). */
export function ArchiveIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
      <path d="M10 12h4" />
    </svg>
  )
}
