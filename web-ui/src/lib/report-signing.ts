// Canonical message a reporter signs to prove wallet ownership without spending gas (see
// api/reports/route.ts). The server reconstructs this independently from the submitted
// (appId, reason) rather than ever trusting a client-supplied message string, so a signature
// can only ever authorize the exact report it was signed for - never replayed against a
// different app or a different reason.
export function buildReportMessage(appId: number, reason: string): string {
  return `Report app #${appId}: ${reason}`;
}
