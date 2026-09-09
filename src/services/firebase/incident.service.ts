interface IncidentReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  photoUrls: string[];
  createdAt: number;
  status: 'submitted' | 'under_review' | 'resolved';
}

export type { IncidentReport };

/**
 * Submits an incident report with optional photo evidence.
 * @phase Phase 7 — Advanced Safety
 */
export function submitIncidentReport(
  _userId: string,
  _report: Omit<IncidentReport, 'id' | 'userId' | 'createdAt' | 'status'>,
): Promise<IncidentReport> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Lists the reports a user has filed.
 * @phase Phase 7 — Advanced Safety
 */
export function getMyIncidentReports(_userId: string): Promise<IncidentReport[]> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}

/**
 * Uploads a piece of photo evidence and returns its download URL.
 * @phase Phase 7 — Advanced Safety
 */
export function uploadIncidentPhoto(_userId: string, _localUri: string): Promise<string> {
  return Promise.reject(new Error('Not implemented — Phase 7'));
}
