/**
 * Build a DOCX Buffer from persisted AssembledRfp / GeneratedSection.
 * No Qwen / provider calls — export only.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageNumber,
  Header,
  Footer,
  PageBreak,
} from 'docx';
import type {
  AssembledRfp,
  GeneratedBlock,
  GeneratedSection,
} from '@/types/generatedSection';

export interface DocxDocumentMeta {
  documentTitle?: string;
  beneficiaryEntity?: string;
  documentType?: string;
  engagementType?: string;
  engagementDuration?: string;
}

function borders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  return { top: b, bottom: b, left: b, right: b };
}

function blockToParagraphs(block: GeneratedBlock): Paragraph[] {
  switch (block.type) {
    case 'heading': {
      const level =
        block.level === 1
          ? HeadingLevel.HEADING_1
          : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      return [
        new Paragraph({
          text: block.text,
          heading: level,
          spacing: { before: 240, after: 120 },
        }),
      ];
    }
    case 'paragraph':
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, size: 22 })],
          spacing: { after: 120 },
        }),
      ];
    case 'bullet_list':
      return block.items.map(
        (item) =>
          new Paragraph({
            text: item,
            bullet: { level: 0 },
            spacing: { after: 60 },
          }),
      );
    case 'numbered_list':
      return block.items.map(
        (item, i) =>
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}. ${item}`, size: 22 })],
            spacing: { after: 60 },
          }),
      );
    case 'table':
      // Tables are handled in sectionBlocksToChildren (Paragraph | Table).
      return [];
    case 'tbc':
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.label.startsWith('[')
                ? block.label
                : `[To be confirmed] ${block.label}`,
              bold: true,
              italics: true,
              color: '92400E',
              size: 20,
            }),
          ],
          spacing: { before: 120, after: 120 },
          border: {
            top: { style: BorderStyle.DASHED, size: 6, color: 'B45309', space: 8 },
            bottom: { style: BorderStyle.DASHED, size: 6, color: 'B45309', space: 8 },
            left: { style: BorderStyle.DASHED, size: 6, color: 'B45309', space: 8 },
            right: { style: BorderStyle.DASHED, size: 6, color: 'B45309', space: 8 },
          },
        }),
      ];
    default:
      return [];
  }
}

type DocChild = Paragraph | Table;

function sectionBlocksToChildren(section: GeneratedSection): DocChild[] {
  const out: DocChild[] = [];
  for (const block of section.blocks) {
    if (block.type === 'table') {
      const headerRow = new TableRow({
        children: block.headers.map(
          (h) =>
            new TableCell({
              borders: borders(),
              width: {
                size: Math.floor(9000 / Math.max(block.headers.length, 1)),
                type: WidthType.DXA,
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h, bold: true, size: 20 })],
                }),
              ],
            }),
        ),
      });
      const bodyRows = block.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: borders(),
                  width: {
                    size: Math.floor(9000 / Math.max(row.length, 1)),
                    type: WidthType.DXA,
                  },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, size: 20 })],
                    }),
                  ],
                }),
            ),
          }),
      );
      out.push(
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: [headerRow, ...bodyRows],
        }),
        new Paragraph({ text: '', spacing: { after: 120 } }),
      );
      continue;
    }
    out.push(...blockToParagraphs(block));
  }
  return out;
}

function missingSectionPlaceholder(title: string, readiness: string): Paragraph[] {
  return [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            readiness === 'NOT_READY'
              ? `[${title} — not yet generated; information incomplete]`
              : `[${title} — not yet generated]`,
          italics: true,
          color: 'B45309',
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

export function safeDocxFilename(meta: DocxDocumentMeta, documentKey: string): string {
  const raw = (meta.documentTitle || documentKey || 'rfp')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${raw || 'rfp'}.docx`;
}

/**
 * Build DOCX from assembled persisted RFP. Skips NOT_APPLICABLE. Marks missing.
 */
export async function buildRfpDocxBuffer(input: {
  assembled: AssembledRfp;
  documentMeta: DocxDocumentMeta;
}): Promise<Buffer> {
  const { assembled, documentMeta } = input;
  const title = documentMeta.documentTitle || 'Request for Proposal';
  const children: DocChild[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'REQUEST FOR PROPOSAL',
          bold: true,
          size: 20,
          color: '64748B',
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      spacing: { after: 120 },
    }),
  );

  if (documentMeta.beneficiaryEntity) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Issued by: ${documentMeta.beneficiaryEntity}`,
            size: 22,
          }),
        ],
        spacing: { after: 60 },
      }),
    );
  }

  const metaLine = [
    documentMeta.documentType,
    documentMeta.engagementType,
    documentMeta.engagementDuration,
  ]
    .filter(Boolean)
    .join(' · ');
  if (metaLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: metaLine, size: 20, color: '475569' })],
        spacing: { after: 200 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Assembled from persisted ProjectSections · ${assembled.generatedApplicableCount}/${assembled.applicableSectionCount} applicable sections generated · ${assembled.approvedApplicableCount} approved`,
          size: 18,
          italics: true,
          color: '64748B',
        }),
      ],
      spacing: { after: 300 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 12 },
      },
    }),
  );

  let firstSection = true;
  for (const slot of assembled.sections) {
    if (!slot.applicable) continue;

    if (!firstSection) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    firstSection = false;

    if (!slot.generated) {
      children.push(...missingSectionPlaceholder(slot.title, slot.readiness));
      continue;
    }

    if (slot.approvalStatus === 'APPROVED') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'APPROVED',
              bold: true,
              size: 16,
              color: '15803D',
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    } else if (slot.approvalStatus === 'DRAFT') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `DRAFT · v${slot.generated.version}`,
              bold: true,
              size: 16,
              color: 'A16207',
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    }

    children.push(...sectionBlocksToChildren(slot.generated));
  }

  const doc = new Document({
    creator: 'RAMI',
    title,
    description: `RFP export for ${assembled.documentKey}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 864,
              right: 864,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title,
                    size: 16,
                    color: '64748B',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ', size: 16, color: '64748B' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
