/**
 * Input validators — Pure validation functions for edge function inputs.
 * 
 * These functions validate user inputs before they reach business logic.
 * They run client-side for UX and are mirrored server-side in edge functions.
 * 
 * All validators return { valid: true } or { valid: false, error: string }.
 */

// ── Types ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SimulationInput {
  segment_id: string;
  stimulus: string;
  workspace_id: string;
  title?: string;
}

export interface FocusGroupInput {
  segment_ids: string[];
  stimulus: string;
  workspace_id: string;
  num_rounds?: number;
}

export interface ABTestInput {
  segment_ids: string[];
  variant_a: string;
  variant_b: string;
  workspace_id: string;
}

export interface MarketSimInput {
  segment_ids: string[];
  product: string;
  pricing?: string | number;
  market_size?: number;
  time_horizon_months?: number;
  workspace_id: string;
}

export interface PolicySimInput {
  segment_ids: string[];
  policy_description: string;
  impact_areas?: string[];
  severity?: string;
  workspace_id: string;
}

// ── Primitive Validators ──────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: unknown, fieldName: string): ValidationResult {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }
  return { valid: true };
}

export function validateString(
  value: unknown,
  fieldName: string,
  opts: { minLength?: number; maxLength?: number } = {},
): ValidationResult {
  const { minLength = 1, maxLength = 10000 } = opts;

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} character(s)` };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }

  return { valid: true };
}

export function validateNumber(
  value: unknown,
  fieldName: string,
  opts: { min?: number; max?: number; required?: boolean } = {},
): ValidationResult {
  const { min, max, required = false } = opts;

  if (value === undefined || value === null || value === "") {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (typeof num !== "number" || isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { valid: true };
}

export function validateArray(
  value: unknown,
  fieldName: string,
  opts: { minLength?: number; maxLength?: number } = {},
): ValidationResult {
  const { minLength = 1, maxLength = 100 } = opts;

  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }
  if (value.length < minLength) {
    return { valid: false, error: `${fieldName} must have at least ${minLength} item(s)` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must have at most ${maxLength} items` };
  }

  return { valid: true };
}

export function validateEnum(
  value: unknown,
  fieldName: string,
  allowedValues: string[],
): ValidationResult {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(", ")}` };
  }
  return { valid: true };
}

// ── Sanitization ──────────────────────────────────────

/**
 * Sanitize a string by trimming and capping length.
 * Strips HTML tags and dangerous characters.
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  if (typeof input !== "string") return "";
  // Strip HTML tags
  let clean = input.replace(/<[^>]*>/g, "");
  // Remove null bytes
  clean = clean.replace(/\0/g, "");
  // Trim whitespace
  clean = clean.trim();
  // Cap length
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

// ── Composite Validators ──────────────────────────────

/**
 * Validate all fields together; returns first error or { valid: true }.
 */
function composeValidations(...validations: ValidationResult[]): ValidationResult {
  for (const v of validations) {
    if (!v.valid) return v;
  }
  return { valid: true };
}

export function validateSimulationInput(input: SimulationInput): ValidationResult {
  return composeValidations(
    validateUUID(input.segment_id, "segment_id"),
    validateString(input.stimulus, "stimulus", { minLength: 1, maxLength: 10000 }),
    validateUUID(input.workspace_id, "workspace_id"),
  );
}

export function validateFocusGroupInput(input: FocusGroupInput): ValidationResult {
  const arrayCheck = validateArray(input.segment_ids, "segment_ids", { minLength: 2, maxLength: 5 });
  if (!arrayCheck.valid) return arrayCheck;

  // Validate each UUID in the array
  for (let i = 0; i < input.segment_ids.length; i++) {
    const uuidCheck = validateUUID(input.segment_ids[i], `segment_ids[${i}]`);
    if (!uuidCheck.valid) return uuidCheck;
  }

  return composeValidations(
    { valid: true }, // array already checked
    validateString(input.stimulus, "stimulus", { minLength: 1, maxLength: 10000 }),
    validateUUID(input.workspace_id, "workspace_id"),
    input.num_rounds !== undefined
      ? validateNumber(input.num_rounds, "num_rounds", { min: 1, max: 3 })
      : { valid: true },
  );
}

export function validateABTestInput(input: ABTestInput): ValidationResult {
  const arrayCheck = validateArray(input.segment_ids, "segment_ids", { minLength: 1, maxLength: 10 });
  if (!arrayCheck.valid) return arrayCheck;

  for (let i = 0; i < input.segment_ids.length; i++) {
    const uuidCheck = validateUUID(input.segment_ids[i], `segment_ids[${i}]`);
    if (!uuidCheck.valid) return uuidCheck;
  }

  return composeValidations(
    { valid: true },
    validateString(input.variant_a, "variant_a", { minLength: 1, maxLength: 5000 }),
    validateString(input.variant_b, "variant_b", { minLength: 1, maxLength: 5000 }),
    validateUUID(input.workspace_id, "workspace_id"),
  );
}

export function validateMarketSimInput(input: MarketSimInput): ValidationResult {
  const arrayCheck = validateArray(input.segment_ids, "segment_ids", { minLength: 1, maxLength: 10 });
  if (!arrayCheck.valid) return arrayCheck;

  for (let i = 0; i < input.segment_ids.length; i++) {
    const uuidCheck = validateUUID(input.segment_ids[i], `segment_ids[${i}]`);
    if (!uuidCheck.valid) return uuidCheck;
  }

  return composeValidations(
    { valid: true },
    validateString(input.product, "product", { minLength: 1, maxLength: 5000 }),
    validateUUID(input.workspace_id, "workspace_id"),
    input.market_size !== undefined
      ? validateNumber(input.market_size, "market_size", { min: 1000, max: 10_000_000 })
      : { valid: true },
    input.time_horizon_months !== undefined
      ? validateNumber(input.time_horizon_months, "time_horizon_months", { min: 6, max: 60 })
      : { valid: true },
    input.pricing !== undefined
      ? validateNumber(input.pricing, "pricing", { min: 0, max: 1_000_000 })
      : { valid: true },
  );
}

const VALID_IMPACT_AREAS = [
  "health", "economy", "environment", "social",
  "education", "technology", "security", "infrastructure",
] as const;

const VALID_SEVERITY = ["low", "moderate", "high", "critical"] as const;

export function validatePolicySimInput(input: PolicySimInput): ValidationResult {
  const arrayCheck = validateArray(input.segment_ids, "segment_ids", { minLength: 1, maxLength: 10 });
  if (!arrayCheck.valid) return arrayCheck;

  for (let i = 0; i < input.segment_ids.length; i++) {
    const uuidCheck = validateUUID(input.segment_ids[i], `segment_ids[${i}]`);
    if (!uuidCheck.valid) return uuidCheck;
  }

  // Validate impact areas if provided
  if (input.impact_areas && input.impact_areas.length > 0) {
    for (const area of input.impact_areas) {
      if (!VALID_IMPACT_AREAS.includes(area as typeof VALID_IMPACT_AREAS[number])) {
        return { valid: false, error: `Invalid impact area: "${area}". Must be one of: ${VALID_IMPACT_AREAS.join(", ")}` };
      }
    }
  }

  return composeValidations(
    { valid: true },
    validateString(input.policy_description, "policy_description", { minLength: 1, maxLength: 5000 }),
    validateUUID(input.workspace_id, "workspace_id"),
    input.severity !== undefined
      ? validateEnum(input.severity, "severity", [...VALID_SEVERITY])
      : { valid: true },
  );
}
