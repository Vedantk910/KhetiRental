import { screen } from "@testing-library/react";
import { renderIntl } from "@/lib/test-intl";
import { Badge } from "./badge";
import { Card } from "./card";
import { EmptyState } from "./empty-state";
import { PriceRow } from "./price-row";
import { Skeleton } from "./skeleton";
import { StickyCTA } from "./sticky-cta";

describe("Badge", () => {
  it.each(["free", "busy", "waiting", "confirmed", "info", "neutral"] as const)(
    "%s carries its text",
    (v) => {
      renderIntl(<Badge variant={v}>Free 2–4 Nov</Badge>);
      expect(screen.getByText("Free 2–4 Nov")).toBeInTheDocument();
    },
  );
  it("sample says Sample in the current language by default", () => {
    renderIntl(<Badge variant="sample" />, { locale: "hi" });
    expect(screen.getByText("नमूना")).toBeInTheDocument();
  });
});

describe("Card", () => {
  it.each(["machine", "booking", "request", "busy"] as const)("%s renders children", (v) => {
    renderIntl(<Card variant={v}>Swaraj 744 FE</Card>);
    expect(screen.getByText("Swaraj 744 FE")).toBeInTheDocument();
  });
  it("can render as an article", () => {
    renderIntl(
      <Card as="article" aria-label="m">
        x
      </Card>,
    );
    expect(screen.getByRole("article", { name: "m" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("has a title, a line and actions", () => {
    renderIntl(
      <EmptyState
        title="No bookings yet."
        body="b"
        actions={<button type="button">Find a machine</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No bookings yet." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find a machine" })).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    const { container } = renderIntl(<Skeleton className="h-6" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("PriceRow", () => {
  it("shows label and value; total is marked", () => {
    renderIntl(
      <>
        <PriceRow label="Diesel" value="Included" />
        <PriceRow label="You pay" value="₹710" total />
      </>,
    );
    expect(screen.getByText("Diesel").parentElement).toHaveTextContent("DieselIncluded");
    expect(screen.getByText("You pay").parentElement).toHaveAttribute("data-total");
  });
});

describe("StickyCTA", () => {
  it("marks the page so the tab bar steps aside, and shows the price summary", () => {
    renderIntl(
      <StickyCTA price="₹710" caption="est. for 2.5 acres">
        <button type="button">Book</button>
      </StickyCTA>,
    );
    expect(document.querySelector("[data-sticky-cta]")).not.toBeNull();
    expect(screen.getByText("₹710")).toBeInTheDocument();
    expect(screen.getByText("est. for 2.5 acres")).toBeInTheDocument();
  });
});
