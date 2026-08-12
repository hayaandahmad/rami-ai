import type {
  InterviewSaveRequest,
  InterviewSaveResponse,
} from "@/types/persistence";

/**
 * Server-only boundary around the Google Sheets persistence backend
 * (currently a Google Apps Script Web App).
 *
 * This is the only file that knows Rami is backed by Google Sheets.
 * Replacing Sheets with another persistence layer later should only
 * require changing this file — callers depend on InterviewSaveRequest /
 * InterviewSaveResponse, not on Apps Script specifics.
 *
 * Must never be imported from client components.
 */

interface AppsScriptSaveRequest extends InterviewSaveRequest {
  secret: string;
}

export class GoogleSheetsConfigError extends Error {}

function getWebhookUrl(): string {
  const url = process.env.RAMI_SHEETS_WEBHOOK_URL;
  if (!url) {
    throw new GoogleSheetsConfigError(
      "RAMI_SHEETS_WEBHOOK_URL is not configured on the server.",
    );
  }
  return url;
}

function getSharedSecret(): string {
  const secret = process.env.RAMI_SHEETS_SECRET;
  if (!secret) {
    throw new GoogleSheetsConfigError(
      "RAMI_SHEETS_SECRET is not configured on the server.",
    );
  }
  return secret;
}

export async function persistInterviewSave(
  request: InterviewSaveRequest,
): Promise<InterviewSaveResponse> {
  const webhookUrl = getWebhookUrl();
  const secret = getSharedSecret();

  const payload: AppsScriptSaveRequest = { ...request, secret };

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to reach the persistence backend: ${error.message}`
          : "Failed to reach the persistence backend.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: `Persistence backend returned a non-JSON response (status ${response.status}).`,
    };
  }

  if (isSuccessBody(body)) {
    return { ok: true };
  }

  if (isErrorBody(body)) {
    return { ok: false, error: body.error };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Persistence backend responded with status ${response.status}.`,
    };
  }

  return {
    ok: false,
    error: "Persistence backend returned an unexpected response shape.",
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
