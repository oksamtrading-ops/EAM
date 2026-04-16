import { z } from "zod";

/**
 * URL field that accepts hostnames without a scheme and prepends https://.
 * Trims whitespace; converts empty/null to null.
 */
export const optionalUrl = () =>
  z
    .preprocess((val) => {
      if (val === null || val === undefined) return null;
      if (typeof val !== "string") return val;
      const trimmed = val.trim();
      if (trimmed === "") return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    }, z.string().url().nullable())
    .optional();
