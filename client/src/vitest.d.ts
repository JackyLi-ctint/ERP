import "@testing-library/jest-dom/vitest";

declare global {
  namespace Vi {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}
