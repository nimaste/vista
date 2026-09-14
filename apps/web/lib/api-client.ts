/** Browser fetch helper — hits Next's same-origin /api proxy. */
export const apiClient = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, body?.message || res.statusText, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

export class ApiError extends Error {
  public override name = "ApiError";
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
  }
}

const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};
