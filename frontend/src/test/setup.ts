import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Stabilize time for all tests to 2026-05-12 (Tuesday)
// We only fake 'Date' to avoid breaking async testing-library utilities like findBy/waitFor
const MOCK_DATE = new Date("2026-05-12T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MOCK_DATE);
  
  const root = document.createElement('div');
  root.id = 'modal-root';
  document.body.appendChild(root);
});

afterEach(() => {
  const root = document.getElementById('modal-root');
  if (root) {
    document.body.removeChild(root);
  }
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock;
}

if (!window.IntersectionObserver) {
  class IntersectionObserverMock {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  window.IntersectionObserver = IntersectionObserverMock as typeof IntersectionObserver;
}

if (!window.scrollTo) {
  window.scrollTo = () => {};
}

if (!window.Notification) {
  (window as any).Notification = {
    permission: "granted",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  };
}
