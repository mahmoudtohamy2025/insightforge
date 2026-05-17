import { describe, expect, it } from "vitest";
import {
  FOUNDER_RESEARCH_HEADERS,
  FOUNDER_RESEARCH_NAV,
} from "@/lib/founderResearchCopy";

describe("founder research workspace copy", () => {
  it("keeps the founder sidebar labels aligned to the new workflow", () => {
    expect(FOUNDER_RESEARCH_NAV.groupLabel).toBe("Talk to Real Customers");
    expect(FOUNDER_RESEARCH_NAV.items.people).toBe("People");
    expect(FOUNDER_RESEARCH_NAV.items.interviews).toBe("Interviews");
    expect(FOUNDER_RESEARCH_NAV.items.rewards).toBe("Rewards");
    expect(FOUNDER_RESEARCH_NAV.items.confidence).toBe("Confidence");
  });

  it("defines plain-language page headers for each founder research surface", () => {
    expect(FOUNDER_RESEARCH_HEADERS.people.title).toBe("People");
    expect(FOUNDER_RESEARCH_HEADERS.people.description).toContain("customer contacts");

    expect(FOUNDER_RESEARCH_HEADERS.interviews.title).toBe("Interviews");
    expect(FOUNDER_RESEARCH_HEADERS.interviews.description).toContain("focus groups");

    expect(FOUNDER_RESEARCH_HEADERS.rewards.title).toBe("Rewards");
    expect(FOUNDER_RESEARCH_HEADERS.rewards.description).toContain("budget");

    expect(FOUNDER_RESEARCH_HEADERS.confidence.title).toBe("Confidence Check");
    expect(FOUNDER_RESEARCH_HEADERS.confidence.description).toContain("real customer evidence");
  });
});
