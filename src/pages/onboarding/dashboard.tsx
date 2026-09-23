import type { GetServerSideProps } from "next";

const DASHBOARD_ONBOARDING_PATH = "/dashboard/me/onboarding";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: DASHBOARD_ONBOARDING_PATH,
    permanent: false,
  },
});

export default function LegacyOnboardingDashboardRedirectPage() {
  return null;
}
