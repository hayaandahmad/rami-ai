import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface ReviewAndGeneratePageProps {
  documentId: string;
}

export function ReviewAndGeneratePage({ documentId }: ReviewAndGeneratePageProps) {
  return (
    <section aria-labelledby="page-heading" className="space-y-4">
      <h1 id="page-heading" className="text-page-title text-text-primary">
        Continue in the project workspace
      </h1>
      <p className="max-w-xl text-body text-text-secondary">
        Conversation, project understanding, section readiness, generation, and Word
        export all live in the project workspace. This older review route is retained
        for compatibility only.
      </p>
      <Link href={`/documents/${documentId}/interview`}>
        <Button>Open project workspace</Button>
      </Link>
    </section>
  );
}
