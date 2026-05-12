import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link href="/dashboard" className="logo" aria-label="ESS Onboarding Portal home">
      <Image src="/logo.svg" alt="ESS Onboarding Portal" className="logo-image" width={32} height={32} />
      {!compact ? <span className="logo-text">ESS Onboarding Portal</span> : null}
    </Link>
  );
}
