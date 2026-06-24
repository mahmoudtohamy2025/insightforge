import { describe, it, expect } from "vitest";
import { buildPersonaPrompt, isMenaSegment } from "../../supabase/functions/_shared/prompts.ts";

const mena = {
  name: "Gulf Shoppers",
  cultural_context: { region: "Saudi Arabia (KSA)", language: "Arabic" },
};
const us = {
  name: "US Millennials",
  cultural_context: { region: "United States", language: "English" },
};

describe("isMenaSegment", () => {
  it("detects a MENA region", () => expect(isMenaSegment(mena.cultural_context)).toBe(true));
  it("detects Arabic language alone", () => expect(isMenaSegment({ language: "Arabic" })).toBe(true));
  it("detects expat nationality in MENA context", () => expect(isMenaSegment({ region: "Dubai, UAE" })).toBe(true));
  it("is false for a non-MENA segment", () => expect(isMenaSegment(us.cultural_context)).toBe(false));
  it("is false for empty/undefined context", () => {
    expect(isMenaSegment({})).toBe(false);
    expect(isMenaSegment(undefined)).toBe(false);
  });
});

describe("buildPersonaPrompt", () => {
  it("adds the MENA cultural layer for MENA segments", () => {
    const p = buildPersonaPrompt(mena);
    expect(p).toContain("MENA CULTURAL LAYER");
    expect(p).toMatch(/Halal/i);
    expect(p).toMatch(/wasta/i);
  });
  it("omits the MENA layer for non-MENA segments", () => {
    expect(buildPersonaPrompt(us)).not.toContain("MENA CULTURAL LAYER");
  });
  it("adds the Ramadan layer only when ramadanMode is set", () => {
    expect(buildPersonaPrompt(mena, { ramadanMode: true })).toContain("RAMADAN");
    expect(buildPersonaPrompt(mena)).not.toContain("SEASONAL CONTEXT");
  });
  it("always includes the persona name + base rules", () => {
    const p = buildPersonaPrompt(us);
    expect(p).toContain("US Millennials");
    expect(p).toContain("IMPORTANT RULES");
  });
  it("honors the concise option", () => {
    expect(buildPersonaPrompt(us, { concise: true })).toContain("2-3 sentences");
  });
});
