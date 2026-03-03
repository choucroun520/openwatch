export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleApiError(error: unknown): Response {
  console.error("[API Error]", error);

  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return Response.json(
      { error: error.message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  return Response.json(
    { error: "An unexpected error occurred", code: "UNKNOWN_ERROR" },
    { status: 500 }
  );
}

export const Errors = {
  UNAUTHORIZED: new AppError("Authentication required", "UNAUTHORIZED", 401),
  FORBIDDEN: new AppError("Access denied", "FORBIDDEN", 403),
  NOT_FOUND: (resource: string) =>
    new AppError(`${resource} not found`, "NOT_FOUND", 404),
  RATE_LIMITED: new AppError(
    "Too many requests. Please try again later.",
    "RATE_LIMITED",
    429
  ),
  INVALID_INVITE: new AppError(
    "Invalid or expired invite code",
    "INVALID_INVITE",
    400
  ),
} as const;
