import { NextResponse } from "next/server";
import { GoogleSheetsConfigError, persistInterviewSave } from "@/server/googleSheets";
import { validateInterviewSaveRequest } from "@/server/interviewSaveValidation";

/**
 * POST /api/interview/save
 *
 * Atomic save contract for Rami's interview persistence:
 *   { answer?: AnswerPersistencePayload, session: SessionPersistencePayload }
 *
 * The browser never sends or receives the Google Sheets shared secret —
 * it is injected server-side in `persistInterviewSave`.
 *
 * Not yet wired into the interview UI (Phase 1 is foundation-only).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateInterviewSaveRequest(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error },
      { status: 400 },
    );
  }

  try {
    const result = await persistInterviewSave(validation.value);

    if (!result.ok) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof GoogleSheetsConfigError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while persisting interview data.",
      },
      { status: 500 },
    );
  }
}
