import { inspectContent } from "../store/content-scanner.js";

export type MemoryTrustLevel = "trusted" | "untrusted";
export type MemoryValidationPhase = "write" | "import" | "recall";

export interface MemoryValidationOptions {
  source: string;
  trustLevel: MemoryTrustLevel;
  phase: MemoryValidationPhase;
}

export interface ValidationResult {
  accepted: boolean;
  normalizedContent?: string;
  secretMatches: string[];
  injectionMatches: string[];
  action: "accept" | "reject" | "quarantine";
  reason?: string;
}

export function normalizeMemoryContent(content: string): string {
  return content.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

/** Single validation policy for write, import, and recall entry points. */
export function validateMemoryContent(
  content: string,
  options: MemoryValidationOptions,
): ValidationResult {
  const normalizedContent = normalizeMemoryContent(content);
  const { secretMatches, injectionMatches } = inspectContent(normalizedContent);

  if (!normalizedContent) {
    return {
      accepted: false,
      secretMatches,
      injectionMatches,
      action: "reject",
      reason: "Memory content is empty after normalization.",
    };
  }

  if (secretMatches.length > 0) {
    return {
      accepted: false,
      secretMatches,
      injectionMatches,
      action: "reject",
      reason: `Rejected ${options.source}: credential or secret detected (${secretMatches.join(", ")}).`,
    };
  }

  if (injectionMatches.length > 0) {
    return {
      accepted: false,
      normalizedContent,
      secretMatches,
      injectionMatches,
      action: "quarantine",
      reason: `Quarantined ${options.source}: prompt-injection content detected (${injectionMatches.join(", ")}).`,
    };
  }

  return {
    accepted: true,
    normalizedContent,
    secretMatches,
    injectionMatches,
    action: "accept",
  };
}
