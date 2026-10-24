import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("is a real button that fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Find machines</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Find machines" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    "primary",
    "secondary",
    "outline-dark",
    "danger-outline",
    "ghost",
    "pill-primary",
    "pill-accent",
    "pill-light",
  ] as const)("renders the %s variant at both sizes", (variant) => {
    render(
      <>
        <Button variant={variant}>a</Button>
        <Button variant={variant} size="md">
          b
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "a" }).className).toMatch(/min-h-tap/);
  });

  it("loading: busy, keeps its name and focus, ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Pay ₹710 and book
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Pay ₹710 and book" });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(b).not.toBeDisabled(); // stays focusable so focus is never dropped mid-submit
    b.focus();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    expect(b).toHaveFocus();
  });

  it("disabled with a reason: shows the reason and links it to the button", async () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="Choose the work and your place" onClick={onClick}>
        Find machines
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Find machines" });
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(b).toHaveAccessibleDescription("Choose the work and your place");
    expect(screen.getByText("Choose the work and your place")).toBeVisible();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
