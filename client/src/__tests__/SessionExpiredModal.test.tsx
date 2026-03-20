import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionExpiredModal } from "../components/SessionExpiredModal";

describe("SessionExpiredModal", () => {
  it("should render correctly with title and button", () => {
    const mockOnConfirm = vi.fn();

    render(<SessionExpiredModal open={true} onConfirm={mockOnConfirm} />);

    expect(screen.getByText("Session Expired")).toBeInTheDocument();
    expect(
      screen.getByText("Your session has expired. Please log in again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("should call onConfirm callback when button is clicked", async () => {
    const mockOnConfirm = vi.fn();
    const user = userEvent.setup();

    render(<SessionExpiredModal open={true} onConfirm={mockOnConfirm} />);

    const button = screen.getByRole("button", { name: /log in/i });
    await user.click(button);

    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it("should not render when open is false", () => {
    const mockOnConfirm = vi.fn();

    const { container } = render(
      <SessionExpiredModal open={false} onConfirm={mockOnConfirm} />
    );

    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();
    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument();
  });
});
