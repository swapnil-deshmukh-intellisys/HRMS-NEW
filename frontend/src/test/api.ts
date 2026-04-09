import { vi } from "vitest";

type MockApiRoute = {
  path: string | RegExp;
  method?: string;
  status?: number;
  message?: string;
  data?: unknown;
  body?: unknown;
};

function normalizeMethod(method?: string) {
  return (method ?? "GET").toUpperCase();
}

function matchesRoute(route: MockApiRoute, url: string, method: string) {
  if (normalizeMethod(route.method) !== method) {
    return false;
  }

  if (typeof route.path === "string") {
    return url.includes(route.path);
  }

  return route.path.test(url);
}

export function mockApiRoutes(routes: MockApiRoute[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = normalizeMethod(init?.method ?? (input instanceof Request ? input.method : undefined));
    const route = routes.find((candidate) => matchesRoute(candidate, url, method));

    if (!route) {
      throw new Error(`Unhandled API request: ${method} ${url}`);
    }

    const status = route.status ?? 200;
    const payload =
      route.body ??
      {
        success: status >= 200 && status < 300,
        message: route.message ?? (status >= 200 && status < 300 ? "OK" : "Request failed"),
        data: route.data ?? null,
      };

    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  });
}
