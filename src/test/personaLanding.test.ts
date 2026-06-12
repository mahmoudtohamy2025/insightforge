import { describe, it, expect } from "vitest";
import { PERSONA_LANDING, DOOR_STORAGE_KEY } from "@/lib/personaLandingCopy";

// Honesty tripwire for the three persona doors (docs/AUDIENCE_MAP.md, PRD §12).
// These strings are banned in ANY context on a door page — each one is a claim
// the product cannot back (same family as the removed SOC 2 badges, "GDPR
// Compliant" chip, "statistical preference scores", and killed studios).
const BANNED_CLAIMS = [
  "statistical",
  "SOC 2",
  "ISO 27001",
  "GDPR Compliant",
  "Policy Impact",
  "50 AI",
  "50 simulated",
  "guarantee",
  "white-label",
  "white label",
];

const DOORS = Object.entries(PERSONA_LANDING);

describe("persona landing doors", () => {
  it("defines exactly the three doors", () => {
    expect(Object.keys(PERSONA_LANDING).sort()).toEqual(["brands", "founders", "product-teams"]);
  });

  for (const [door, copy] of DOORS) {
    describe(door, () => {
      it("contains no banned claims", () => {
        const text = JSON.stringify(copy).toLowerCase();
        for (const banned of BANNED_CLAIMS) {
          expect(text, `"${banned}" must not appear on the ${door} door`).not.toContain(
            banned.toLowerCase(),
          );
        }
      });

      it("has the full page structure", () => {
        expect(copy.headline.length).toBeGreaterThan(10);
        expect(copy.subheadline.length).toBeGreaterThan(20);
        expect(copy.pains).toHaveLength(3);
        expect(copy.steps).toHaveLength(3);
        expect(copy.features).toHaveLength(4);
        expect(copy.cta.toLowerCase()).toContain("free");
      });

      it("admits simulated signal honestly", () => {
        expect(copy.honestNote.toLowerCase()).toContain("simulated");
      });
    });
  }

  it("brands door is scoped to text — and says so", () => {
    const text = JSON.stringify(PERSONA_LANDING.brands).toLowerCase();
    expect(text).toContain("visual-creative formats aren't yet");
    // No benchmark/percentile PROMISES — the honest note may negate them.
    expect(text).not.toMatch(/with (percentile|benchmark)/);
  });

  it("door storage key follows the app's localStorage naming convention", () => {
    expect(DOOR_STORAGE_KEY).toBe("insightforge-door");
  });
});
