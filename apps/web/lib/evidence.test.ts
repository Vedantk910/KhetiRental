import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EVIDENCE, LOAD_TEST_RUNS, RESUME_BULLETS } from "./evidence";

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
    const all = JSON.stringify({ EVIDENCE, LOAD_TEST_RUNS, RESUME_BULLETS });
    for (const banned of ["8.6", "48.2", "94%", "99.98", "45-page", "82%"]) {
      expect(all).not.toContain(banned);
    }
  });

  it("the resume sheet carries every bullet verbatim", () => {
    const sheet = readFileSync(path.join(repo, "docs/interview/resume-bullets.md"), "utf8");
    for (const b of [...RESUME_BULLETS.trackA, ...RESUME_BULLETS.trackB]) expect(sheet).toContain(b);
  });

  it("every resume bullet is X-Y-Z: action verb, a number, and a 'by' clause", () => {
    for (const b of [...RESUME_BULLETS.trackA, ...RESUME_BULLETS.trackB]) {
      expect(b).toMatch(/^(Cut|Eliminated|Engineered|Authored|Designed|Built)\b/);
      expect(b).toMatch(/\d/);
      expect(b).toMatch(/ by /);
    }
  });
});
