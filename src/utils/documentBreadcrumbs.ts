import { mockDocuments } from "@/data/mockDocuments";

export function getDocumentTitle(documentId: string): string {
  return mockDocuments.find((document) => document.id === documentId)?.title ?? "Document";
}
