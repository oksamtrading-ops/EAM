import type { RiskLikelihood, RiskImpact } from "@/generated/prisma/client";

export const LIKELIHOOD_SCORE: Record<RiskLikelihood, number> = {
  RARE: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
};

export const IMPACT_SCORE: Record<RiskImpact, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function computeRiskScore(
  likelihood: RiskLikelihood,
  impact: RiskImpact
): number {
  return LIKELIHOOD_SCORE[likelihood] * IMPACT_SCORE[impact];
}

export function scoreLabel(
  score: number
): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 12) return "Critical";
  if (score >= 6) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

export function scoreLabelFromFactors(
  likelihood: RiskLikelihood,
  impact: RiskImpact
): "Low" | "Medium" | "High" | "Critical" {
  return scoreLabel(computeRiskScore(likelihood, impact));
}

/** Urgency band for EOL entries based on days until EOL */
export function eolUrgencyBand(eolDate: Date | null | undefined): string {
  if (!eolDate) return "HEALTHY";
  const now = new Date();
  const daysUntil = Math.ceil(
    (eolDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return "EXPIRED";
  if (daysUntil < 90) return "URGENT";
  if (daysUntil < 180) return "WARNING";
  if (daysUntil < 365) return "APPROACHING";
  if (daysUntil < 3 * 365) return "PLANNED";
  return "HEALTHY";
}

export const URGENCY_BAND_ORDER: Record<string, number> = {
  EXPIRED: 0,
  URGENT: 1,
  WARNING: 2,
  APPROACHING: 3,
  PLANNED: 4,
  HEALTHY: 5,
};
