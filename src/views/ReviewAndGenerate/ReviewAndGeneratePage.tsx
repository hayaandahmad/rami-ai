interface ReviewAndGeneratePageProps {
  documentId: string;
}

export function ReviewAndGeneratePage({ documentId }: ReviewAndGeneratePageProps) {
  return (
    <section aria-labelledby="page-heading">
      <p className="text-body text-text-muted">
        Review and generate for document {documentId} will be implemented in Page 3.
      </p>
    </section>
  );
}
