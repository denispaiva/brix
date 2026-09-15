/**
 * Recomendación determinista a partir del score global y la banda de confianza.
 * Umbrales inclusivos: 75 es advance, 60 es advance_with_reservations. Un score
 * null (sin evidencia suficiente en ningún factor) da insufficient_evidence directo,
 * sin mirar la confianza. Solo confianza "low" degrada advance — los demás
 * resultados nunca cambian automáticamente por confianza.
 */
export function computeBaselineRecommendation(overallScore, confidenceBand, policy) {
  if (overallScore == null) return "insufficient_evidence";

  const { advance, advanceWithReservations } = policy.recommendationThresholds;
  let recommendation;
  if (overallScore >= advance) recommendation = "advance";
  else if (overallScore >= advanceWithReservations) recommendation = "advance_with_reservations";
  else recommendation = "do_not_advance";

  if (recommendation === "advance" && confidenceBand === "low") {
    return "advance_with_reservations";
  }
  return recommendation;
}
