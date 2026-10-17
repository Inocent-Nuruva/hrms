/** PATCH must distinguish clearing an assignment from leaving it unchanged. */
export function onboardingStepAssignmentPayload(step: {
  assigned_role_id?: number
  assigned_user_id?: number
  assigned_department_id?: number
}) {
  const idOrNull = (id: number | undefined) =>
    typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null
  return {
    assigned_role_id: idOrNull(step.assigned_role_id),
    assigned_user_id: idOrNull(step.assigned_user_id),
    assigned_department_id: idOrNull(step.assigned_department_id),
  }
}
