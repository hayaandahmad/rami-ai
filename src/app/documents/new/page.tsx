import { AppLayout } from "@/layouts/AppLayout";
import { DocumentTypeSelectionPage } from "@/views/DocumentTypeSelection/DocumentTypeSelectionPage";

export default function NewDocumentRoute() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard / Workspace", href: "/workspace" },
        { label: "Choose Document Type" },
      ]}
    >
      <DocumentTypeSelectionPage />
    </AppLayout>
  );
}
