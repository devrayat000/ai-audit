import { notFound } from "next/navigation";
import { readAuditReport } from "@/lib/audit/storage";
import { AuditReportView } from "@/components/audit-report";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ auditId: string }>;
}

export default async function ResultsPage(props: PageProps) {
  const params = await props.params;
  const report = await readAuditReport(params.auditId);

  if (!report) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Back to homepage
          </Button>
        </Link>
      </div>
      <AuditReportView report={report} />
    </div>
  );
}
