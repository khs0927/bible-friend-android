import type { z } from 'zod';
import { API_ERROR_MESSAGES, type ApiErrorBody, type ApiErrorCode } from './core/index.ts';

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  bad_request: 400,
  quota_exceeded: 429,
  upstream_error: 502,
  not_found: 404,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? API_ERROR_MESSAGES[code]);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = { error: error.code, message: error.message };
    return json(body, STATUS[error.code]);
  }
  console.error('[function] unhandled error', error);
  const body: ApiErrorBody = { error: 'internal', message: API_ERROR_MESSAGES.internal };
  return json(body, 500);
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  if (req.method !== 'POST') throw new ApiError('bad_request', 'POST only');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError('bad_request');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError('bad_request');
  return parsed.data;
}

/** Wraps a handler so thrown ApiErrors become JSON responses. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch(errorResponse);
}
