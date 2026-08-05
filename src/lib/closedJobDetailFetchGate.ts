/**
 * Client gate for GET /api/closed-job-detail.
 * The API is session-scoped (cookie); companyId is only used after the response
 * to shape the Job model. An empty companyId must NOT block the HTTP call.
 */
export function shouldFetchClosedJobDetail(opts: {
  enabled: boolean;
  jobId: number | null | undefined;
}): boolean {
  if (!opts.enabled) return false;
  const id = Number(opts.jobId);
  return Number.isFinite(id) && id > 0;
}

export function resolveClosedJobDetailCompanyId(companyId: string | null | undefined): string {
  const fromProp = String(companyId ?? '').trim();
  if (fromProp) return fromProp;
  try {
    return String(localStorage.getItem('bw_company_id') || '').trim();
  } catch {
    return '';
  }
}
