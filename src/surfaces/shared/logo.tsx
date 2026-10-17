type LogoProps = { size?: number };

export function Logo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="5.5" fill="var(--logo-planet)" />
      <ellipse cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="var(--logo-ring)" strokeWidth={2} transform="rotate(-18 12 12)" />
      <path d="M6.8 12.9a5.5 5.5 0 0 0 10.6-1" fill="var(--logo-planet)" />
    </svg>
  );
}
