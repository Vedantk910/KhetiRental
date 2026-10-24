import { describe, expect, it } from "vitest";
import { checkDocument, namesMatch, validateListing } from "./marketplace-kyc";

const good = {
  make: "Mahindra",
  model: "275 DI",
  year: "2021",
  hp: "35",
  implements: ["Rotavator"],
  cost: "390000",
  listerName: "Ramesh Patil",
  rcName: "RAMESH  PATIL",
};

describe("namesMatch", () => {
  it("ignores case, spacing, punctuation and word order", () => {
    expect(namesMatch("Ramesh Patil", "PATIL, Ramesh.")).toBe(true);
  });
  it("rejects different or empty names", () => {
    expect(namesMatch("Ramesh Patil", "Suresh Patil")).toBe(false);
    expect(namesMatch("", "")).toBe(false);
  });
});

describe("checkDocument", () => {
  it("accepts small pdf/jpg/png", () => {
    expect(checkDocument({ name: "a.pdf", type: "application/pdf", size: 1000 }).ok).toBe(true);
  });
  it("rejects other types, empty and large files", () => {
    expect(checkDocument({ name: "a.exe", type: "application/x-msdownload", size: 10 }).ok).toBe(false);
    expect(checkDocument({ name: "a.png", type: "image/png", size: 0 }).ok).toBe(false);
    expect(checkDocument({ name: "a.png", type: "image/png", size: 9e6 }).ok).toBe(false);
  });
});

describe("validateListing", () => {
  it("passes a good form", () => {
    expect(validateListing(good)).toEqual({});
  });
  it("flags each bad field", () => {
    const e = validateListing({
      ...good,
      make: "",
      model: " ",
      year: "1850",
      hp: "",
      implements: [],
      cost: "-5",
    });
    expect(Object.keys(e).sort()).toEqual(["cost", "hp", "implements", "make", "model", "year"]);
  });
  it("blocks on RC owner mismatch (D-07)", () => {
    expect(validateListing({ ...good, rcName: "Suresh Jadhav" }).rcName).toMatch(/does not match/i);
  });
});
