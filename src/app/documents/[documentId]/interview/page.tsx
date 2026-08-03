import { AppLayout } from "@/layouts/AppLayout";
import { GuidedDocumentInterviewPage } from "@/views/GuidedDocumentInterview/GuidedDocumentInterviewPage";
import { getDocumentTitle } from "@/utils/documentBreadcrumbs";

interface InterviewRouteProps {
  params: Promise<{ documentId: string }>;
}

export default async function InterviewRoute({ params }: InterviewRouteProps) {
  const { documentId } = await params;
  const documentTitle = getDocumentTitle(documentId);

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard / Workspace", href: "/workspace" },
        { label: documentTitle, href: `/documents/${documentId}/interview` },
        { label: "Interview" },
      ]}
    >
      <GuidedDocumentInterviewPage documentId={documentId} />
    </AppLayout>
  );
}
