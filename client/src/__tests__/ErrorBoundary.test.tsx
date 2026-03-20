import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Suppress console.error for this test file
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Component that throws on render for testing
const ThrowingComponent = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("should catch error and display fallback UI with default message", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("should reload the page when Reload Page button is clicked", async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, reload: reloadSpy };

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    const button = screen.getByRole("button", { name: /reload page/i });
    await user.click(button);

    expect(reloadSpy).toHaveBeenCalled();

    (window as any).location = originalLocation;
  });

  it("should render custom fallback when provided", () => {
    const customFallback = <div>Custom Error UI</div>;
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
  });
});
