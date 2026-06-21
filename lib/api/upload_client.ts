/** User-facing messages for public upload failures. */
export function uploadErrorMessage(err: unknown, httpStatus?: number, bodyError?: string): string {
  if (httpStatus === 429) {
    return bodyError ?? "Too many uploads. Please wait a minute and try again.";
  }
  if (httpStatus === 413) {
    return "Photo file is too large. Try a smaller image.";
  }
  if (httpStatus === 503) {
    return bodyError ?? "Uploads are temporarily unavailable.";
  }
  if (httpStatus === 428) {
    return "Security check failed. Please try again.";
  }
  if (bodyError) return bodyError;
  if (err instanceof TypeError || (err instanceof Error && err.message === "Failed to fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Submission failed";
}

export async function readJsonError(res: Response): Promise<string | undefined> {
  try {
    const body = await res.json() as { error?: string };
    return body.error;
  } catch {
    return undefined;
  }
}
