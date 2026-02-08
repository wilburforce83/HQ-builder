import "@testing-library/jest-dom";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof (globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver === "undefined") {
  (globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;
}
