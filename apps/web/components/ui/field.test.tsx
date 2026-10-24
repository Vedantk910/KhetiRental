import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, Select, Textarea } from "./field";

describe("Input", () => {
  it("has a visible label, a hint and no error by default", () => {
    render(<Input label="Mobile number" hint="We'll send a 6-digit OTP by SMS." />);
    const i = screen.getByLabelText("Mobile number");
    expect(i).toHaveAccessibleDescription("We'll send a 6-digit OTP by SMS.");
    expect(i).not.toHaveAttribute("aria-invalid");
  });

  it("invalid: aria-invalid and the error is described", () => {
    render(<Input label="Mobile number" hint="hint" error="Enter a 10-digit mobile number." />);
    const i = screen.getByLabelText("Mobile number");
    expect(i).toHaveAttribute("aria-invalid", "true");
    expect(i).toHaveAccessibleDescription(/Enter a 10-digit mobile number\./);
  });

  it("renders a prefix box and accepts typing", async () => {
    render(<Input label="Mobile number" prefix="+91" />);
    expect(screen.getByText("+91")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Mobile number"), "९८७");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("९८७");
  });
});

describe("Select / Textarea", () => {
  it("select is labelled and changes", async () => {
    render(
      <Select label="Sort" defaultValue="a">
        <option value="a">Nearest</option>
        <option value="b">Cheapest</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "b");
    expect(screen.getByLabelText("Sort")).toHaveValue("b");
  });

  it("textarea is labelled and can be invalid", () => {
    render(<Textarea label="What went wrong?" error="Required" />);
    expect(screen.getByLabelText("What went wrong?")).toHaveAttribute("aria-invalid", "true");
  });
});
