import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/common/Card";
import { ONBOARDING_STEPS } from "@/utils/constants";

export default function OnboardingIndexPage() {
  return (
    <DashboardLayout title="Onboarding">
      <Card
        title="Checklist"
        description="Complete each step in order. APIs for submission and status updates can be connected later in the service layer."
      >
        <ol className="step-list">
          {ONBOARDING_STEPS.map((step, index) => (
            <li key={step.id} className="step-item">
              <div>
                <p className="step-index">Step {index + 1}</p>
                <h3>{step.title}</h3>
                <p className="meta-text">{step.description}</p>
              </div>
              <Link href={step.route} className="text-link">
                Open
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </DashboardLayout>
  );
}
