import type { DocumentProject } from "@/types/document";
import { DocumentCard } from "./DocumentCard";

interface DocumentGridProps {
  documents: DocumentProject[];
}

export function DocumentGrid({ documents }: DocumentGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
}
