export interface ApiSuccess<T> {
  ok: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T, message?: string, init?: ResponseInit) {
  return Response.json(
    { ok: true, data, ...(message ? { message } : {}) } satisfies ApiSuccess<T>,
    init,
  );
}

export function failure(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message, ...(details === undefined ? {} : { details }) },
    } satisfies ApiFailure,
    { status },
  );
}

export function describeUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
