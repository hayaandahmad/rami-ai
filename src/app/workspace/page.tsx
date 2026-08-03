import { AppLayout } from "@/layouts/AppLayout";
import { DocumentWorkspacePage } from "@/views/DocumentWorkspace/DocumentWorkspacePage";

export default function WorkspaceRoute() {
  return (
    <AppLayout
      breadcrumbs={[{ label: "Dashboard / Workspace" }]}
    >
      <DocumentWorkspacePage />
    </AppLayout>
  );
}
