import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EVIDENCE, LOAD_TEST_RUNS } from "./evidence";

const repo = path.resolve(__dirname, "../../..");

describe("evidence", () => {
  it("every headline figure names a source file that exists in the repo", () => {
    for (const e of Object.values(EVIDENCE)) {
      expect(e.value).toBeTruthy();
      expect(existsSync(path.join(repo, e.source)), `${e.label}: ${e.source}`).toBe(true);
    }
  });

  it("load-test figures match what showcase/ARCHITECTURE.md records", () => {
    const arch = readFileSync(path.join(repo, "showcase/ARCHITECTURE.md"), "utf8");
    expect(arch).toContain("p95 **0.66 ms**");
    expect(arch).toContain("p99 **2.91 ms**");
    expect(EVIDENCE.p99.value).toBe("2.91 ms");
    expect(LOAD_TEST_RUNS.at(-1)?.p95Ms).toBe(0.66);
  });

  it("uses no figure the codebase never produced", () => {
    const all = JSON.stringify({ EVIDENCE, LOAD_TEST_RUNS });
    for (const banned of ["8.6", "48.2", "94%", "99.98", "45-page", "82%"]) {
      expect(all).not.toContain(banned);
    }
  });
});
