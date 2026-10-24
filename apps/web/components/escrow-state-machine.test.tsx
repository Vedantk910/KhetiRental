import { fireEvent, render, screen } from "@testing-library/react";
import { EscrowStateMachine } from "./escrow-state-machine";

const click = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const stage = () => screen.getByTestId("escrow-stage").textContent;

describe("EscrowStateMachine", () => {
  it("walks the happy path to settlement and keeps the ledger balanced", () => {
    render(<EscrowStateMachine />);
    expect(stage()).toMatch(/pre-auth/i);
    click(/authorise escrow/i);
    click(/complete handover/i);
    expect(stage()).toMatch(/telematics/i);
    click(/return machine/i);
    click(/settle/i);
    expect(stage()).toMatch(/settled/i);
    expect(screen.getByTestId("ledger-check")).toHaveTextContent(/balanced/i);
  });

  it("geofence breach opens a dispute and freezes the deposit", () => {
    render(<EscrowStateMachine />);
    click(/authorise escrow/i);
    click(/complete handover/i);
    click(/simulate geofence breach/i);
    expect(stage()).toMatch(/dispute/i);
    expect(screen.getByTestId("rule-fired")).toHaveTextContent("D-01");
    expect(screen.getByRole("button", { name: /settle/i })).toBeDisabled();
    expect(screen.getByText(/stage 2: telematics window \(disputed\)/i)).toBeInTheDocument();
  });

  it("hour tamper opens a D-02 dispute", () => {
    render(<EscrowStateMachine />);
    click(/authorise escrow/i);
    click(/complete handover/i);
    click(/simulate hour tamper/i);
    expect(screen.getByTestId("rule-fired")).toHaveTextContent("D-02");
  });

  it("only enables actions valid for the current stage", () => {
    render(<EscrowStateMachine />);
    expect(screen.getByRole("button", { name: /complete handover/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /settle/i })).toBeDisabled();
  });

  it("reset returns to pre-auth", () => {
    render(<EscrowStateMachine />);
    click(/authorise escrow/i);
    click(/reset/i);
    expect(stage()).toMatch(/pre-auth/i);
  });
});
