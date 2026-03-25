export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
export const FILE_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const isFormData = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = options.body
    ? isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body)
    : undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: requestBody,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload;
}

export function getFileUrl(path?: string | null) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${FILE_BASE_URL}${path}`;
}
