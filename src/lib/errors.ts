export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = () => new AppError("You need to sign in.", "UNAUTHENTICATED");
export const forbidden = (message = "You don't have permission to do that.") =>
  new AppError(message, "FORBIDDEN");
export const notFound = (what = "Item") => new AppError(`${what} not found.`, "NOT_FOUND");
export const conflict = (message: string) => new AppError(message, "CONFLICT");

/** For pages: turns a service's NOT_FOUND into Next's 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  const { notFound: nextNotFound } = await import("next/navigation");
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") nextNotFound();
    throw error;
  }
}
