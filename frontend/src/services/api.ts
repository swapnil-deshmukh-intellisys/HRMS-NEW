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

export class ApiError extends Error {
  status?: number;
  errors?: any[];
  
  constructor(message: string, status?: number, errors?: any[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, retryCount = 0): Promise<ApiResponse<T>> {
  const maxRetries = 2;
  const isFormData = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = options.body
    ? isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body)
    : undefined;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: requestBody,
    });

    const contentType = response.headers.get("content-type");
    let payload: any;

    if (contentType?.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();
      // If we expected JSON but got something else, it's usually a platform error (500/502/503)
      if (!response.ok) {
        throw new ApiError(
          `Server Error: ${response.status} ${response.statusText}`, 
          response.status
        );
      }
      payload = { success: true, data: text };
    }

    if (!response.ok) {
      // 1. Retry logic for recoverable server errors
      const isRecoverable = [500, 502, 503, 504].includes(response.status);
      const isRateLimited = response.status === 429;

      if ((isRecoverable || isRateLimited) && retryCount < maxRetries) {
        const delay = isRateLimited ? 2000 : 1000;
        console.warn(`Recoverable error ${response.status} on ${path}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay * (retryCount + 1)));
        return apiRequest<T>(path, options, retryCount + 1);
      }

      // 2. Specific error messages
      if (response.status === 401) {
        throw new ApiError("Session expired. Please login again.", 401);
      }
      
      if (response.status === 403) {
        throw new ApiError("You don't have permission to perform this action.", 403);
      }

      throw new ApiError(
        payload?.message || `Request failed with status ${response.status}`,
        response.status,
        payload?.errors
      );
    }

    return payload as ApiResponse<T>;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;

    // Handle Network Level aborts/failures
    if (error.name === 'TypeError' || error.name === 'AbortError') {
       if (retryCount < maxRetries) {
          console.warn(`Network error on ${path}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return apiRequest<T>(path, options, retryCount + 1);
       }
       throw new ApiError("Network error. Please check your connection.", 0);
    }

    throw error;
  }
}

export function getFileUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${FILE_BASE_URL}${path}`;
}
