"use client";

import type {
  InterviewSaveRequest,
  InterviewSaveResponse,
} from "@/types/persistence";

/**
 * Client-safe persistence boundary for Rami's interview data.
 *
 * This is the ONLY thing the browser is allowed to know: Rami's own
 * `/api/interview/save` route. It never knows the Google Apps Script
 * URL, never sees the Sheets secret, and never talks to Apps Script
 * directly — the server route (`src/app/api/interview/save/route.ts`)
 * and the server-only client (`src/server/googleSheets.ts`) own that.
 */
export async function persistInterview(
  request: InterviewSaveRequest,
): Promise<InterviewSaveResponse> {
  let response: Response;

  try {
    response = await fetch("/api/interview/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Could not reach the server: ${error.message}`
          : "Could not reach the server.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: `Save request failed (status ${response.status}).`,
    };
  }

  if (isSuccessBody(body)) {
    return { ok: true };
  }

  if (isErrorBody(body)) {
    return { ok: false, error: body.error };
  }

  return {
    ok: false,
    error: `Save request failed (status ${response.status}).`,
  };
}

function isSuccessBody(body: unknown): body is { ok: true } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === true
  );
}

function isErrorBody(body: unknown): body is { ok: false; error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === false &&
    typeof (body as { error?: unknown }).error === "string"
  );
}
