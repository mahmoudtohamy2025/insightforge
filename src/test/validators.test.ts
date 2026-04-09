import { describe, it, expect } from "vitest";
import {
  validateUUID,
  validateString,
  validateNumber,
  validateArray,
  validateEnum,
  sanitizeString,
  validateSimulationInput,
  validateFocusGroupInput,
  validateABTestInput,
  validateMarketSimInput,
  validatePolicySimInput,
} from "@/lib/validators";

// ── Primitive Validators ──────────────────────────────

describe("validateUUID", () => {
  it("accepts valid UUID v4", () => {
    expect(validateUUID("550e8400-e29b-41d4-a716-446655440000", "id").valid).toBe(true);
    expect(validateUUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890", "id").valid).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(validateUUID("not-a-uuid", "id").valid).toBe(false);
    expect(validateUUID("", "id").valid).toBe(false);
    expect(validateUUID("123", "id").valid).toBe(false);
    expect(validateUUID(null, "id").valid).toBe(false);
    expect(validateUUID(undefined, "id").valid).toBe(false);
    expect(validateUUID(123, "id").valid).toBe(false);
  });

  it("includes field name in error message", () => {
    const result = validateUUID("bad", "workspace_id");
    expect(result.error).toContain("workspace_id");
  });
});

describe("validateString", () => {
  it("accepts valid strings", () => {
    expect(validateString("hello", "name").valid).toBe(true);
    expect(validateString("a", "name").valid).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(validateString(123, "name").valid).toBe(false);
    expect(validateString(null, "name").valid).toBe(false);
    expect(validateString(undefined, "name").valid).toBe(false);
    expect(validateString([], "name").valid).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(validateString("", "name").valid).toBe(false);
    expect(validateString("   ", "name").valid).toBe(false); // whitespace only
  });

  it("enforces maxLength", () => {
    expect(validateString("ab", "name", { maxLength: 1 }).valid).toBe(false);
    expect(validateString("a", "name", { maxLength: 1 }).valid).toBe(true);
  });

  it("enforces minLength", () => {
    expect(validateString("a", "name", { minLength: 5 }).valid).toBe(false);
    expect(validateString("hello", "name", { minLength: 5 }).valid).toBe(true);
  });
});

describe("validateNumber", () => {
  it("accepts valid numbers", () => {
    expect(validateNumber(42, "count").valid).toBe(true);
    expect(validateNumber(0, "count").valid).toBe(true);
    expect(validateNumber(-1, "count").valid).toBe(true);
  });

  it("accepts numeric strings", () => {
    expect(validateNumber("42", "count").valid).toBe(true);
    expect(validateNumber("3.14", "count").valid).toBe(true);
  });

  it("rejects non-numeric strings", () => {
    expect(validateNumber("abc", "count").valid).toBe(false);
  });

  it("allows undefined/null when not required", () => {
    expect(validateNumber(undefined, "count").valid).toBe(true);
    expect(validateNumber(null, "count").valid).toBe(true);
  });

  it("rejects undefined/null when required", () => {
    expect(validateNumber(undefined, "count", { required: true }).valid).toBe(false);
    expect(validateNumber(null, "count", { required: true }).valid).toBe(false);
  });

  it("enforces min/max bounds", () => {
    expect(validateNumber(5, "count", { min: 10 }).valid).toBe(false);
    expect(validateNumber(15, "count", { max: 10 }).valid).toBe(false);
    expect(validateNumber(10, "count", { min: 5, max: 15 }).valid).toBe(true);
  });
});

describe("validateArray", () => {
  it("accepts valid arrays", () => {
    expect(validateArray(["a", "b"], "items").valid).toBe(true);
    expect(validateArray([1], "items").valid).toBe(true);
  });

  it("rejects non-arrays", () => {
    expect(validateArray("not array", "items").valid).toBe(false);
    expect(validateArray(null, "items").valid).toBe(false);
    expect(validateArray({}, "items").valid).toBe(false);
  });

  it("enforces minLength", () => {
    expect(validateArray([], "items").valid).toBe(false); // default min=1
    expect(validateArray(["a"], "items", { minLength: 2 }).valid).toBe(false);
  });

  it("enforces maxLength", () => {
    expect(validateArray(["a", "b", "c"], "items", { maxLength: 2 }).valid).toBe(false);
  });
});

describe("validateEnum", () => {
  it("accepts valid enum values", () => {
    expect(validateEnum("high", "severity", ["low", "moderate", "high"]).valid).toBe(true);
  });

  it("rejects invalid enum values", () => {
    expect(validateEnum("extreme", "severity", ["low", "moderate", "high"]).valid).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(validateEnum(42, "severity", ["low", "moderate", "high"]).valid).toBe(false);
  });

  it("error message lists allowed values", () => {
    const result = validateEnum("bad", "severity", ["low", "high"]);
    expect(result.error).toContain("low");
    expect(result.error).toContain("high");
  });
});

// ── Sanitization ──────────────────────────────────────

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<script>alert('xss')</script>Hello")).toBe("alert('xss')Hello");
    expect(sanitizeString("<b>bold</b>")).toBe("bold");
    expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("removes null bytes", () => {
    expect(sanitizeString("hello\0world")).toBe("helloworld");
  });

  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("caps length", () => {
    const long = "a".repeat(200);
    expect(sanitizeString(long, 100)).toHaveLength(100);
  });

  it("handles non-string gracefully", () => {
    expect(sanitizeString(null as any)).toBe("");
    expect(sanitizeString(undefined as any)).toBe("");
    expect(sanitizeString(123 as any)).toBe("");
  });

  it("handles SQL injection patterns", () => {
    const result = sanitizeString("'; DROP TABLE users; --");
    expect(result).toBe("'; DROP TABLE users; --"); // SQL injection is safe in params
  });
});

// ── Composite Validators ──────────────────────────────

describe("validateSimulationInput", () => {
  const validInput = {
    segment_id: "550e8400-e29b-41d4-a716-446655440000",
    stimulus: "How do you feel about this product?",
    workspace_id: "660e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts valid input", () => {
    expect(validateSimulationInput(validInput).valid).toBe(true);
  });

  it("rejects missing segment_id", () => {
    expect(validateSimulationInput({ ...validInput, segment_id: "" }).valid).toBe(false);
  });

  it("rejects invalid segment_id UUID", () => {
    expect(validateSimulationInput({ ...validInput, segment_id: "not-uuid" }).valid).toBe(false);
  });

  it("rejects empty stimulus", () => {
    expect(validateSimulationInput({ ...validInput, stimulus: "" }).valid).toBe(false);
    expect(validateSimulationInput({ ...validInput, stimulus: "   " }).valid).toBe(false);
  });

  it("rejects stimulus over 10000 chars", () => {
    const longStimulus = "x".repeat(10001);
    expect(validateSimulationInput({ ...validInput, stimulus: longStimulus }).valid).toBe(false);
  });
});

describe("validateFocusGroupInput", () => {
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const uuid2 = "660e8400-e29b-41d4-a716-446655440000";
  const uuid3 = "770e8400-e29b-41d4-a716-446655440000";
  const wsId = "880e8400-e29b-41d4-a716-446655440000";

  const validInput = {
    segment_ids: [uuid1, uuid2],
    stimulus: "What do you think?",
    workspace_id: wsId,
    num_rounds: 2,
  };

  it("accepts valid input with 2 segments", () => {
    expect(validateFocusGroupInput(validInput).valid).toBe(true);
  });

  it("rejects fewer than 2 segments", () => {
    expect(validateFocusGroupInput({ ...validInput, segment_ids: [uuid1] }).valid).toBe(false);
  });

  it("rejects more than 5 segments", () => {
    const sixUUIDs = Array(6).fill(uuid1);
    expect(validateFocusGroupInput({ ...validInput, segment_ids: sixUUIDs }).valid).toBe(false);
  });

  it("validates each UUID in segment_ids", () => {
    expect(
      validateFocusGroupInput({ ...validInput, segment_ids: [uuid1, "bad-uuid"] }).valid,
    ).toBe(false);
  });

  it("rejects num_rounds > 3", () => {
    expect(validateFocusGroupInput({ ...validInput, num_rounds: 5 }).valid).toBe(false);
  });

  it("accepts num_rounds of 1, 2, or 3", () => {
    expect(validateFocusGroupInput({ ...validInput, num_rounds: 1 }).valid).toBe(true);
    expect(validateFocusGroupInput({ ...validInput, num_rounds: 3 }).valid).toBe(true);
  });
});

describe("validateABTestInput", () => {
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const wsId = "880e8400-e29b-41d4-a716-446655440000";

  it("accepts valid input", () => {
    const result = validateABTestInput({
      segment_ids: [uuid1],
      variant_a: "Product A description",
      variant_b: "Product B description",
      workspace_id: wsId,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty variants", () => {
    expect(
      validateABTestInput({
        segment_ids: [uuid1],
        variant_a: "",
        variant_b: "B",
        workspace_id: wsId,
      }).valid,
    ).toBe(false);
  });

  it("rejects variants over 5000 chars", () => {
    expect(
      validateABTestInput({
        segment_ids: [uuid1],
        variant_a: "x".repeat(5001),
        variant_b: "B",
        workspace_id: wsId,
      }).valid,
    ).toBe(false);
  });
});

describe("validateMarketSimInput", () => {
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const wsId = "880e8400-e29b-41d4-a716-446655440000";

  const validInput = {
    segment_ids: [uuid1],
    product: "Organic meal kit service",
    workspace_id: wsId,
    market_size: 100000,
    time_horizon_months: 24,
    pricing: "29.99",
  };

  it("accepts valid input", () => {
    expect(validateMarketSimInput(validInput).valid).toBe(true);
  });

  it("rejects market_size below 1000", () => {
    expect(validateMarketSimInput({ ...validInput, market_size: 500 }).valid).toBe(false);
  });

  it("rejects market_size above 10M", () => {
    expect(validateMarketSimInput({ ...validInput, market_size: 20_000_000 }).valid).toBe(false);
  });

  it("rejects time_horizon below 6", () => {
    expect(validateMarketSimInput({ ...validInput, time_horizon_months: 3 }).valid).toBe(false);
  });

  it("rejects time_horizon above 60", () => {
    expect(validateMarketSimInput({ ...validInput, time_horizon_months: 120 }).valid).toBe(false);
  });

  it("accepts optional fields being undefined", () => {
    expect(
      validateMarketSimInput({
        segment_ids: [uuid1],
        product: "Test",
        workspace_id: wsId,
      }).valid,
    ).toBe(true);
  });
});

describe("validatePolicySimInput", () => {
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const wsId = "880e8400-e29b-41d4-a716-446655440000";

  it("accepts valid input with valid impact areas", () => {
    const result = validatePolicySimInput({
      segment_ids: [uuid1],
      policy_description: "Mandatory 4-day work week",
      impact_areas: ["economy", "social"],
      severity: "moderate",
      workspace_id: wsId,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid impact areas", () => {
    const result = validatePolicySimInput({
      segment_ids: [uuid1],
      policy_description: "Test policy",
      impact_areas: ["economy", "invalid_area"],
      workspace_id: wsId,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid_area");
  });

  it("rejects invalid severity", () => {
    const result = validatePolicySimInput({
      segment_ids: [uuid1],
      policy_description: "Test policy",
      severity: "extreme",
      workspace_id: wsId,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts valid severity values", () => {
    for (const sev of ["low", "moderate", "high", "critical"]) {
      expect(
        validatePolicySimInput({
          segment_ids: [uuid1],
          policy_description: "Test",
          severity: sev,
          workspace_id: wsId,
        }).valid,
      ).toBe(true);
    }
  });
});
