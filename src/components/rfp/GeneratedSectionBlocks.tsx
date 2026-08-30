/**
 * Renders GeneratedSection.blocks — shared model for A4 preview and later DOCX.
 * Does not invent a parallel content model.
 */

'use client';

import type { GeneratedBlock, GeneratedSection } from '@/types/generatedSection';

export function GeneratedSectionBlocks({
  section,
  className = '',
}: {
  section: GeneratedSection;
  className?: string;
}) {
  return (
    <div className={`rfp-section-body ${className}`} data-section-id={section.sectionId}>
      {section.blocks.map((block, i) => (
        <GeneratedBlockView key={`${section.sectionId}-${i}-${block.type}`} block={block} />
      ))}
    </div>
  );
}

export function GeneratedBlockView({ block }: { block: GeneratedBlock }) {
  switch (block.type) {
    case 'heading': {
      if (block.level === 1) {
        return <h1 className="rfp-h1">{block.text}</h1>;
      }
      if (block.level === 2) {
        return <h2 className="rfp-h2">{block.text}</h2>;
      }
      return <h3 className="rfp-h3">{block.text}</h3>;
    }
    case 'paragraph':
      return <p className="rfp-p">{block.text}</p>;
    case 'bullet_list':
      return (
        <ul className="rfp-ul">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'numbered_list':
      return (
        <ol className="rfp-ol">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="rfp-table-wrap">
          <table className="rfp-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'tbc':
      return (
        <aside className="rfp-tbc" data-field-id={block.fieldId ?? undefined}>
          <span className="rfp-tbc-label">{block.label}</span>
        </aside>
      );
    default:
      return null;
  }
}
