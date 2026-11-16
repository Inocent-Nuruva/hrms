import {
  listContracts,
  listMyContracts,
  type ContractRow,
} from "@/lib/contracts-api";

/** Load all pages without bypassing the existing HR or self-service permissions. */
export async function loadContractVersions(
  token: string,
  employeeId: number,
): Promise<ContractRow[]> {
  try {
    const rows: ContractRow[] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await listContracts(token, {
        employee_id: employeeId,
        limit: 100,
        page,
      });
      rows.push(...result.data);
      total = result.total;
      if (!result.data.length) break;
      page += 1;
    } while (rows.length < total);
    return rows.filter((row) => row.employeeId === employeeId);
  } catch {
    return (await listMyContracts(token)).filter(
      (row) => row.employeeId === employeeId,
    );
  }
}
