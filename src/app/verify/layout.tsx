import type { Metadata } from "next";

// Verification links carry a bearer token: keep them out of search engines
// and out of Referer headers sent to other sites.
export const metadata: Metadata = {
  title: "Document verification",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
