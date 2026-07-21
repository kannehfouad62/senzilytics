import { ExposureResultClassification } from "@prisma/client";

export function classifyExposureResult(input: {
  resultValue: number | null;
  reportingLimit: number | null;
  actionLevel: number | null;
  occupationalLimit: number | null;
}) {
  if (input.resultValue === null) return ExposureResultClassification.NOT_EVALUATED;
  if (input.reportingLimit !== null && input.resultValue < input.reportingLimit) return ExposureResultClassification.BELOW_DETECTION;
  if (input.occupationalLimit !== null && input.resultValue > input.occupationalLimit) return ExposureResultClassification.ABOVE_LIMIT;
  const threshold = input.actionLevel ?? input.occupationalLimit;
  if (threshold !== null && input.resultValue >= threshold) return ExposureResultClassification.AT_OR_ABOVE_ACTION_LEVEL;
  return ExposureResultClassification.BELOW_ACTION_LEVEL;
}

export function exposureRatio(resultValue: number | null, occupationalLimit: number | null) {
  if (resultValue === null || occupationalLimit === null || occupationalLimit <= 0) return null;
  return Math.round((resultValue / occupationalLimit) * 1000) / 1000;
}
