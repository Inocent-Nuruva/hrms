import { cn } from "@/lib/utils";

import "country-flag-icons/3x2/flags.css";

const ISO_CODE = /^[A-Z]{2}(?:-[A-Z0-9]{2,3})?$/;

/**
 * One shared stylesheet instead of the 536-module React flag barrel.
 * Namespace imports of `country-flag-icons/react/3x2` pull every flag into
 * the first page that needs a single icon.
 */
export function CountryFlag({
  code,
  title,
  className,
}: {
  code: string | null | undefined;
  title?: string;
  className?: string;
}) {
  const iso = code?.trim().toUpperCase() ?? "";
  if (!ISO_CODE.test(iso)) return null;

  return (
    <span
      role="img"
      aria-label={title ?? iso}
      title={title ?? iso}
      className={cn(
        `flag:${iso}`,
        "inline-block shrink-0 overflow-hidden rounded-[2px] border border-border bg-cover bg-center align-middle",
        className,
      )}
    />
  );
}
