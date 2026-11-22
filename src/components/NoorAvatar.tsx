export function NoorAvatar({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 128" aria-hidden="true">
      <rect x="16" y="34" width="88" height="62" rx="24" fill="#F6F8FC" />
      <rect x="27" y="45" width="66" height="40" rx="14" fill="#0A1426" />
      <circle cx="46" cy="64" r="6" fill="#5CE1E6" />
      <circle cx="74" cy="64" r="6" fill="#5CE1E6" />
      <rect x="34" y="98" width="52" height="26" rx="12" fill="#FF9A3C" />
      <rect x="58" y="18" width="4" height="16" fill="#F6F8FC" />
      <circle cx="60" cy="16" r="8" fill="#5CE1E6" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <div className="w-[38px] h-[38px] rounded-xl grid place-items-center border border-[var(--line)] bg-gradient-to-b from-[#16325A] to-[#0B1730]" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5CE1E6" strokeWidth="2.4" strokeLinecap="round">
        <ellipse cx="8" cy="12" rx="5" ry="3.6" />
        <ellipse cx="16" cy="12" rx="5" ry="3.6" />
      </svg>
    </div>
  );
}
