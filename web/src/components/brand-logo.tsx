import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandLogo({
  className = "",
  subtitle = "GoProvisions",
  compact = false,
}: BrandLogoProps) {
  const imageWidth = compact ? 140 : 180;
  const imageHeight = compact ? 54 : 68;

  return (
    <div className={`logo-slot ${className}`.trim()}>
      <Image
        src="/go-ecommerce-logo.png"
        alt="go eCommerce Logo"
        width={imageWidth}
        height={imageHeight}
        priority
      />
      {!compact ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
            Provisions Portal
          </p>
          <p className="text-xs text-[var(--brand-text-muted)]">{subtitle}</p>
        </div>
      ) : null}
    </div>
  );
}
