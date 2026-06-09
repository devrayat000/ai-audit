import { NextRequest } from "next/server";
import { readAuditReport } from "@/lib/audit/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ auditId: string }> }
) {
  const params = await props.params;
  const auditId = params.auditId;

  const report = await readAuditReport(auditId);
  if (!report) {
    return Response.json(
      { error: "Audit report not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return Response.json(report);
}
