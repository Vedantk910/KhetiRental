import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListingFormView } from "./listing-form";

const pdf = (name: string) => new File(["x"], name, { type: "application/pdf" });

async function fill(user: ReturnType<typeof userEvent.setup>, rcName = "Ramesh Patil") {
  await user.type(screen.getByLabelText("Make"), "Mahindra");
  await user.type(screen.getByLabelText("Model"), "275 DI");
  await user.type(screen.getByLabelText("Year bought or made"), "2021");
  await user.selectOptions(screen.getByLabelText("Horsepower tier"), "35");
  await user.type(screen.getByLabelText(/What you paid/), "390000");
  await user.click(screen.getByLabelText("Rotavator"));
  await user.type(screen.getByLabelText("Your full name"), "Ramesh Patil");
  await user.type(screen.getByLabelText("Owner name printed on the RC"), rcName);
}

describe("ListingFormView", () => {
  it("shows the demo privacy note", () => {
    render(<ListingFormView />);
    expect(screen.getByText(/nothing leaves your device/i)).toBeInTheDocument();
  });

  it("validates, ties errors to fields and focuses the first one", async () => {
    const user = userEvent.setup();
    render(<ListingFormView />);
    await user.click(screen.getByRole("button", { name: "List my tractor" }));
    const make = screen.getByLabelText("Make");
    expect(make).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(make.getAttribute("aria-describedby")!)).toHaveTextContent(/make/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/Fix \d+ things/);
    await new Promise((r) => requestAnimationFrame(r));
    expect(make).toHaveFocus();
  });

  it("verifies a dropped or chosen document instantly with a checkmark, rejects bad types", async () => {
    const user = userEvent.setup();
    render(<ListingFormView />);
    const aadhaar = screen.getByLabelText("Aadhaar", { selector: "input" });
    await user.upload(aadhaar, pdf("aadhaar.pdf"));
    expect(screen.getByText(/Aadhaar verified/)).toBeInTheDocument();
    const rc = screen.getByLabelText(/Registration certificate/, { selector: "input" });
    await user.upload(rc, new File(["x"], "rc.png", { type: "image/png" }));
    expect(screen.getByText(/Registration certificate \(RC\) verified/)).toBeInTheDocument();
  });

  it("rejects an unsupported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ListingFormView />);
    await user.upload(
      screen.getByLabelText("Aadhaar", { selector: "input" }),
      new File(["x"], "a.exe", { type: "application/x-msdownload" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/PDF, JPG or PNG/);
    expect(screen.queryByText(/Aadhaar verified/)).toBeNull();
  });

  it("blocks the listing when the RC owner is someone else (D-07)", async () => {
    const user = userEvent.setup();
    render(<ListingFormView />);
    await fill(user, "Suresh Jadhav");
    await user.upload(screen.getByLabelText("Aadhaar", { selector: "input" }), pdf("a.pdf"));
    await user.upload(
      screen.getByLabelText(/Registration certificate/, { selector: "input" }),
      pdf("rc.pdf"),
    );
    await user.click(screen.getByRole("button", { name: "List my tractor" }));
    expect(screen.getByText(/does not match your name/i)).toBeInTheDocument();
    expect(screen.queryByText(/is listed/)).toBeNull();
  });

  it("lists the tractor when everything checks out", async () => {
    const user = userEvent.setup();
    render(<ListingFormView />);
    await fill(user);
    await user.upload(screen.getByLabelText("Aadhaar", { selector: "input" }), pdf("a.pdf"));
    await user.upload(
      screen.getByLabelText(/Registration certificate/, { selector: "input" }),
      pdf("rc.pdf"),
    );
    await user.click(screen.getByRole("button", { name: "List my tractor" }));
    expect(within(screen.getByRole("status")).getByText(/Mahindra 275 DI is listed/)).toBeInTheDocument();
  });
});
