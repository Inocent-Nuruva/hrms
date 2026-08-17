import { AccessOrganizationDetailView } from "@/components/dashboard/access-organization-detail-view"

interface OrganizationDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OrganizationDetailPage({
  params,
}: OrganizationDetailPageProps) {
  const { id } = await params

  return <AccessOrganizationDetailView organizationId={id} />
}
