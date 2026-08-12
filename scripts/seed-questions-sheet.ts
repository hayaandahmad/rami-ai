/**
 * One-time seed generator for the Google Sheet "questions" tab.
 *
 * Derives every row directly from Rami's real question source files —
 * it never hand-duplicates question text or IDs, so the Sheet cannot
 * silently drift from the interview engine.
 *
 * Usage:
 *   npm run seed:questions
 *
 * Then copy the printed TSV block and paste it starting at cell A1 of
 * the "questions" tab (paste will fill columns correctly because the
 * output is tab-separated).
 *
 * The running application never writes to the "questions" tab —
 * this script is the only source for that data.
 */
import { mockInterviewScript } from "../src/data/mockInterviewScript";
import { getInterviewSectionLabel } from "../src/data/interviewSections";
import { DEMO_DOCUMENT_TYPE } from "../src/data/documentTypes";

const HEADERS = [
  "question_id",
  "document_type",
  "section_id",
  "section_label",
  "answer_field",
  "question_text",
  "input_type",
  "required",
  "allow_tbc",
  "is_follow_up",
  "follow_up_of",
] as const;

function escapeForTsv(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function buildRows(): string[][] {
  return mockInterviewScript.map((question) => [
    question.id,
    DEMO_DOCUMENT_TYPE,
    question.sectionId,
    getInterviewSectionLabel(question.sectionId),
    question.answerField,
    escapeForTsv(question.prompt),
    question.inputType,
    String(question.required),
    String(question.allowTbc),
    String(question.isFollowUpQuestion ?? false),
    question.followUpTriggeredBy ?? "",
  ]);
}

function main(): void {
  const rows = buildRows();
  const lines = [HEADERS.join("\t"), ...rows.map((row) => row.join("\t"))];
  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
