import { EvaluationDetail } from "@/components/dashboard/kpi/evaluation-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <EvaluationDetail id={Number(id)} personal />; }
