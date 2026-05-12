import Link from "next/link";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { ONBOARDING_STEPS } from "@/utils/constants";

export default function OnboardingStepPage() {
  const router = useRouter();
  const stepParam = typeof router.query.step === "string" ? router.query.step : "";

  const currentIndex = ONBOARDING_STEPS.findIndex((item) => item.id === stepParam);
  const currentStep = currentIndex >= 0 ? ONBOARDING_STEPS[currentIndex] : null;
  const previousStep = currentIndex > 0 ? ONBOARDING_STEPS[currentIndex - 1] : null;
  const nextStep =
    currentIndex >= 0 && currentIndex < ONBOARDING_STEPS.length - 1
      ? ONBOARDING_STEPS[currentIndex + 1]
      : null;

  if (!currentStep) {
    return (
      <DashboardLayout title="Onboarding step">
        <Card title="Step not found" description="The onboarding step requested does not exist.">
          <Link href="/onboarding" className="text-link">
            Back to onboarding checklist
          </Link>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={currentStep.title}>
      <Card
        title={currentStep.title}
        description="Production API integration for this step can be attached to src/services and consumed from this page."
      >
        <p className="meta-text">{currentStep.description}</p>
        <div className="step-placeholder">
          <p>
            Implement fields and actions for <strong>{currentStep.title}</strong> here.
          </p>
        </div>

        <div className="actions-row">
          {previousStep ? (
            <Button type="button" variant="secondary" onClick={() => router.push(previousStep.route)}>
              Previous
            </Button>
          ) : (
            <span />
          )}

          {nextStep ? (
            <Button type="button" onClick={() => router.push(nextStep.route)}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={() => router.push("/dashboard")}>
              Finish
            </Button>
          )}
        </div>
      </Card>
    </DashboardLayout>
  );
}
