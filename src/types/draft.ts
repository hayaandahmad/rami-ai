export type DraftBlock =
  | { type: "paragraph"; text: string }
  | { type: "numbered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "tbc"; label: string };

export interface DraftSection {
  id: string;
  title: string;
  content: DraftBlock[];
}

export interface DocumentDraft {
  documentId: string;
  documentType: string;
  title: string;
  generatedAt: string;
  sections: DraftSection[];
}
