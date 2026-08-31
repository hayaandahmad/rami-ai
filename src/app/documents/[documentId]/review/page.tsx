import { AppLayout } from "@/layouts/AppLayout";
import { ReviewAndGeneratePage } from "@/views/ReviewAndGenerate/ReviewAndGeneratePage";
import { getDocumentTitle } from "@/utils/documentBreadcrumbs";

interface ReviewRouteProps {
  params: Promise<{ documentId: string }>;
}

export default async function ReviewRoute({ params }: ReviewRouteProps) {
  const { documentId } = await params;
  const documentTitle = await getDocumentTitle(documentId);

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard / Workspace", href: "/workspace" },
        { label: documentTitle, href: `/documents/${documentId}/interview` },
        { label: "Review and Generate" },
      ]}
    >
      <ReviewAndGeneratePage documentId={documentId} />
    </AppLayout>
  );
}
