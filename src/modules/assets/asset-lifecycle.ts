import { AssetMaintenanceStatus, AssetStatus } from "@prisma/client";

const assetTransitions: Record<AssetStatus, AssetStatus[]> = {
  ACTIVE: [AssetStatus.OUT_OF_SERVICE, AssetStatus.UNDER_MAINTENANCE, AssetStatus.QUARANTINED, AssetStatus.RETIRED],
  OUT_OF_SERVICE: [AssetStatus.ACTIVE, AssetStatus.UNDER_MAINTENANCE, AssetStatus.QUARANTINED, AssetStatus.RETIRED],
  UNDER_MAINTENANCE: [AssetStatus.ACTIVE, AssetStatus.OUT_OF_SERVICE, AssetStatus.QUARANTINED, AssetStatus.RETIRED],
  QUARANTINED: [AssetStatus.ACTIVE, AssetStatus.OUT_OF_SERVICE, AssetStatus.UNDER_MAINTENANCE, AssetStatus.RETIRED],
  RETIRED: [],
};

const maintenanceTransitions: Record<AssetMaintenanceStatus, AssetMaintenanceStatus[]> = {
  SCHEDULED: [AssetMaintenanceStatus.IN_PROGRESS, AssetMaintenanceStatus.COMPLETED, AssetMaintenanceStatus.CANCELLED, AssetMaintenanceStatus.OVERDUE],
  IN_PROGRESS: [AssetMaintenanceStatus.COMPLETED, AssetMaintenanceStatus.CANCELLED],
  OVERDUE: [AssetMaintenanceStatus.IN_PROGRESS, AssetMaintenanceStatus.COMPLETED, AssetMaintenanceStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const getAssetNextStatuses = (status: AssetStatus) => [
  ...assetTransitions[status],
];

export const getMaintenanceNextStatuses = (
  status: AssetMaintenanceStatus
) => [...maintenanceTransitions[status]];

export const canTransitionAssetStatus = (from: AssetStatus, to: AssetStatus) => from === to || assetTransitions[from].includes(to);
export const canTransitionMaintenanceStatus = (from: AssetMaintenanceStatus, to: AssetMaintenanceStatus) => from === to || maintenanceTransitions[from].includes(to);
export const nextAssetDueDate = (from: Date, intervalDays: number) => {
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) throw new Error("Asset interval must be between 1 and 3650 days.");
  return new Date(from.getTime() + intervalDays * 86400000);
};
