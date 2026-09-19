export const MOBILE_REGISTER_LIMITS = {
  actionCenterTasks: 50,
  actionCenterCorrectiveActions: 50,
  riskRecords: 75,
  jsaRecords: 50,
  mocRecords: 75,
  permitRecords: 75,
  assetRecords: 100,
  contractorRecords: 100,
  hygieneAssessments: 100,
  surveillancePrograms: 75,
  chemicalRecords: 200,
  environmentalDefinitions: 150,
  environmentalTargets: 150,
  esgPeriods: 50,
  esgDefinitions: 250,
  esgTargets: 250,
  esgInitiatives: 250,
  behaviorPrograms: 75,
  regulatorySources: 150,
  regulatoryChanges: 200,
} as const;

export type MobileRegisterKey = keyof typeof MOBILE_REGISTER_LIMITS;

export type MobileRegisterWindow = {
  limit: number;
  returned: number;
  hasMore: boolean;
};

export function mobileRegisterWindow(
  key: MobileRegisterKey,
  returned: number
): MobileRegisterWindow {
  const limit = MOBILE_REGISTER_LIMITS[key];
  return {
    limit,
    returned,
    hasMore: returned >= limit,
  };
}
