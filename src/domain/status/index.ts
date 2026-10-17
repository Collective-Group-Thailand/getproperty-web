/**
 * `src/domain/status` — how each API status looks (F1 1.3 §3). One file per enum, each typed against
 * the generated contract enum (or the backend's planned values until it is published, via
 * `ContractEnum`). Labels live in `common/status.json` under `status.<domain>.<value>`.
 */
export { defineStatuses, type StatusMeta, type StatusTone } from "./define";
export { COMMAND_STATUS, COMMAND_VALUES, type CommandStatus } from "./command";
export { DEPOSIT_STATUS, DEPOSIT_VALUES, type DepositStatus } from "./deposit";
export { DEVICE_STATUS, DEVICE_VALUES, type DeviceStatus } from "./device";
export { INSPECTION_STATUS, INSPECTION_VALUES, type InspectionStatus } from "./inspection";
export { INVOICE_STATUS, INVOICE_VALUES, type InvoiceStatus } from "./invoice";
export { LEASE_STATUS, LEASE_VALUES, type LeaseStatus } from "./lease";
export { METER_HEALTH_STATUS, METER_HEALTH_VALUES, type MeterHealth } from "./meterHealth";
export { PAYMENT_STATUS, PAYMENT_VALUES, type PaymentStatus } from "./payment";
export { READING_STATUS, READING_VALUES, type ReadingReviewState } from "./reading";
export { READING_SOURCE, READING_SOURCE_VALUES, type ReadingSource } from "./readingSource";
export { SERVICE_REQUEST_STATUS, SERVICE_REQUEST_VALUES, type ServiceRequestStatus } from "./serviceRequest";
export { SUBSCRIPTION_STATUS, SUBSCRIPTION_VALUES, type SubscriptionState } from "./subscription";
export { UNIT_STATUS, UNIT_VALUES, type UnitStatus } from "./unit";
export { WORK_ORDER_STATUS, WORK_ORDER_VALUES, type WorkOrderStatus } from "./workOrder";
export { BILLING_CYCLE_STATUS, BILLING_CYCLE_VALUES, type BillingCycleStatus } from "./billingCycle";
export { SLIP_STATUS, SLIP_VALUES, type SlipStatus } from "./slip";
export { SETTLEMENT_STATUS, SETTLEMENT_VALUES, type SettlementStatus } from "./settlement";
export { READING_REVIEW_STATUS, READING_REVIEW_VALUES, type ReadingReviewStatus } from "./readingReview";
export { INVITATION_STATUS, INVITATION_VALUES, type InvitationState } from "./invitation";
export { EXPORT_JOB_STATUS, EXPORT_JOB_VALUES, type ExportStatus } from "./exportJob";
export { REMINDER_STATUS, REMINDER_VALUES, type ReminderStatus } from "./reminder";
export { INVOICE_CHARGE_STATUS, INVOICE_CHARGE_VALUES, type InvoiceChargeStatus } from "./invoiceCharge";

import { COMMAND_STATUS } from "./command";
import { DEPOSIT_STATUS } from "./deposit";
import { DEVICE_STATUS } from "./device";
import { INSPECTION_STATUS } from "./inspection";
import { INVOICE_STATUS } from "./invoice";
import { LEASE_STATUS } from "./lease";
import { METER_HEALTH_STATUS } from "./meterHealth";
import { PAYMENT_STATUS } from "./payment";
import { READING_STATUS } from "./reading";
import { READING_SOURCE } from "./readingSource";
import { SERVICE_REQUEST_STATUS } from "./serviceRequest";
import { SUBSCRIPTION_STATUS } from "./subscription";
import { UNIT_STATUS } from "./unit";
import { WORK_ORDER_STATUS } from "./workOrder";
import { BILLING_CYCLE_STATUS } from "./billingCycle";
import { SLIP_STATUS } from "./slip";
import { SETTLEMENT_STATUS } from "./settlement";
import { READING_REVIEW_STATUS } from "./readingReview";
import { INVITATION_STATUS } from "./invitation";
import { EXPORT_JOB_STATUS } from "./exportJob";
import { REMINDER_STATUS } from "./reminder";
import { INVOICE_CHARGE_STATUS } from "./invoiceCharge";

/** Every status map by its domain key (the `status.<domain>` namespace of its labels). */
export const STATUS_MAPS = {
  invoice: INVOICE_STATUS,
  lease: LEASE_STATUS,
  payment: PAYMENT_STATUS,
  deposit: DEPOSIT_STATUS,
  reading: READING_STATUS,
  readingSource: READING_SOURCE,
  meterHealth: METER_HEALTH_STATUS,
  device: DEVICE_STATUS,
  command: COMMAND_STATUS,
  inspection: INSPECTION_STATUS,
  serviceRequest: SERVICE_REQUEST_STATUS,
  workOrder: WORK_ORDER_STATUS,
  unit: UNIT_STATUS,
  subscription: SUBSCRIPTION_STATUS,
  billingCycle: BILLING_CYCLE_STATUS,
  slip: SLIP_STATUS,
  settlement: SETTLEMENT_STATUS,
  readingReview: READING_REVIEW_STATUS,
  invitation: INVITATION_STATUS,
  exportJob: EXPORT_JOB_STATUS,
  reminder: REMINDER_STATUS,
  invoiceCharge: INVOICE_CHARGE_STATUS,
} as const;

export type StatusDomain = keyof typeof STATUS_MAPS;
