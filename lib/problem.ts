import { NextResponse } from "next/server";

export interface ProblemDetail {
  code: string;
  title: string;
  detail: string;
  status: number;
}

export function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
): NextResponse {
  return NextResponse.json({ code, title, detail }, { status });
}

export const Problems = {
  BAD_REQUEST: (detail: string) => problem(400, "bad_request", "Bad Request", detail),
  UNAUTHORIZED: (detail = "Authentication required.") =>
    problem(401, "unauthorized", "Unauthorized", detail),
  FORBIDDEN: (detail = "You do not have permission to perform this action.") =>
    problem(403, "forbidden", "Forbidden", detail),
  NOT_FOUND: (detail = "Resource not found.") =>
    problem(404, "not_found", "Not Found", detail),
  CONFLICT: (detail: string) => problem(409, "conflict", "Conflict", detail),
  UNPROCESSABLE: (detail: string) =>
    problem(422, "unprocessable_entity", "Unprocessable Entity", detail),
  TOO_MANY_REQUESTS: (detail: string) =>
    problem(429, "too_many_requests", "Too Many Requests", detail),
  INTERNAL: (detail = "An unexpected error occurred.") =>
    problem(500, "internal_error", "Internal Server Error", detail),
} as const;
