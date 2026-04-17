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

export async function apiRequest<T>(path: string, options: RequestOptions = {}, retryCount = 0) {
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

    // Handle network errors
    if (!response) {
      throw new Error("Network error - no response received");
    }

    let payload: ApiResponse<T>;
    
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      // Handle cases where response is not valid JSON (e.g., HTML error pages)
      const text = await response.text();
      console.error(`Non-JSON response from ${path}:`, text.substring(0, 200));
      
      if (response.status === 429) {
        throw new Error("Too many requests - please wait a moment and try again");
      }
      
      throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      // Handle 500 errors with retry logic
      if (response.status === 500 && retryCount < maxRetries) {
        console.warn(`Server error on ${path}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return apiRequest<T>(path, options, retryCount + 1);
      }
      
      // Handle 429 rate limiting with retry
      if (response.status === 429 && retryCount < maxRetries) {
        console.warn(`Rate limited on ${path}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Longer backoff for rate limiting
        return apiRequest<T>(path, options, retryCount + 1);
      }
      
      if (response.status === 429) {
        throw new Error("Too many requests - please wait a moment and try again");
      }
      
      throw new Error(payload.message ?? `Request failed with status ${response.status}`);
    }

    return payload;
  } catch (error) {
    // Handle fetch errors (network issues, CORS, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      if (retryCount < maxRetries) {
        console.warn(`Network error on ${path}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return apiRequest<T>(path, options, retryCount + 1);
      }
      throw new Error("Network error - please check your connection");
    }
    
    // Handle rate limiting errors that bubble up
    if (error instanceof Error && error.message.includes('Too many requests') && retryCount < maxRetries) {
      console.warn(`Rate limiting on ${path}, retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
      return apiRequest<T>(path, options, retryCount + 1);
    }
    
    throw error;
  }
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
