export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
}

/** Read the full request body, rejecting when actual byte count exceeds maxBytes. */
export async function readBodyWithLimit(
  req: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const body = req.body;
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) return new Uint8Array();
  if (chunks.length === 1) return chunks[0]!;

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function limitedRequest(req: Request, bytes: Uint8Array): Request {
  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: bytes.byteLength > 0 ? (bytes as unknown as BodyInit) : null,
  });
}

export async function readJsonWithLimit<T = unknown>(
  req: Request,
  maxBytes: number,
): Promise<T> {
  const bytes = await readBodyWithLimit(req, maxBytes);
  const limited = limitedRequest(req, bytes);
  return await limited.json() as T;
}

export async function readFormDataWithLimit(
  req: Request,
  maxBytes: number,
): Promise<FormData> {
  const bytes = await readBodyWithLimit(req, maxBytes);
  const limited = limitedRequest(req, bytes);
  return await limited.formData();
}
