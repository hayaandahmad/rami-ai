import { DOCUMENT_TYPE_DEFINITIONS } from "@/data/documentTypes";
import { DocumentTypeCard } from "./DocumentTypeCard";

export function DocumentTypeGrid() {
  return (
    <section
      aria-labelledby="document-types-heading"
      className="overflow-hidden rounded-panel border border-border-strong bg-workspace-panel-surface shadow-card-elevated"
    >
      <div className="border-b border-border bg-surface-muted px-5 py-5 md:px-6 md:py-6">
        <h2 id="document-types-heading" className="text-section-title text-text-primary">
          Supported Document Types
        </h2>
        <p className="document-types-description mt-2 text-small leading-relaxed text-text-secondary">
          Rami supports multiple approved document workflows. System Implementation is demonstrated in the current prototype.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 md:p-6 xl:grid-cols-3 2xl:grid-cols-4">
        {DOCUMENT_TYPE_DEFINITIONS.map((definition) => (
          <DocumentTypeCard key={definition.id} definition={definition} />
        ))}
      </div>
    </section>
  );
}
