/**
 * GeekSlides v2 — Standard error response format.
 *
 * All API error responses use this shape so clients can display
 * actionable diagnostics rather than bare HTTP status codes.
 */

export interface ErrorResponse {
  /** Machine-readable error code (e.g. "BLOCKED_HOST", "INVALID_URL"). */
  readonly code: string;
  /** Human-readable explanation of what went wrong. */
  readonly message: string;
  /** Additional context (URL attempted, file path, etc.). */
  readonly details?: Record<string, unknown>;
  /** Actionable fix or debugging step for the user. */
  readonly hint?: string;
  /** Unix epoch ms — correlate with server logs. */
  readonly timestamp: number;
}

/**
 * Serialise an ErrorResponse to JSON and write it to an HTTP response.
 */
export function sendErrorResponse(
  res: { writeHead(status: number, headers: Record<string, string | number>): void; end(body: string): void },
  status: number,
  error: Omit<ErrorResponse, 'timestamp'>,
): void {
  const body = JSON.stringify({ ...error, timestamp: Date.now() });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
