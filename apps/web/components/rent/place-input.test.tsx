import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderIntl } from "@/lib/test-intl";
import { PlaceInput } from "./place-input";

function Harness() {
  const [v, setV] = useState("");
  return <PlaceInput value={v} onText={setV} onPick={() => undefined} />;
}

const answer = (items: unknown[]) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items })));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlaceInput", () => {
  it("says so when a PIN or village matches nothing, instead of staying silent", async () => {
    answer([]);
    renderIntl(<Harness />);
    await userEvent.type(screen.getByRole("combobox"), "560001");
    expect(await screen.findByRole("status")).toHaveTextContent(/don't know this PIN code or village yet/);
  });

  it("shows no message while there are matches or before enough is typed", async () => {
    answer([{ pin: "413512", village: "Latur", label: "413512 · Latur, Maharashtra", lat: 18.4, lng: 76.5 }]);
    renderIntl(<Harness />);
    await userEvent.type(screen.getByRole("combobox"), "41");
    expect(screen.queryByRole("status")).toBeNull();
    await userEvent.type(screen.getByRole("combobox"), "3");
    expect(await screen.findByRole("option")).toHaveTextContent("Latur");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
