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

export { PLATFORM_INVOICE_STATUS, PLATFORM_INVOICE_VALUES, type PlatformInvoiceStatus } from "./platformInvoice";
export { CREDIT_NOTE_STATUS, CREDIT_NOTE_VALUES, type PlatformCreditNoteState } from "./creditNote";
export { HAAS_STATUS, HAAS_VALUES, type HaasState } from "./haas";
export { INSTALL_ORDER_STATUS, INSTALL_ORDER_VALUES, type InstallOrderState } from "./installOrder";
export { SITE_SURVEY_STATUS, SITE_SURVEY_VALUES, type SiteSurveyState } from "./siteSurvey";
export { SUPPORT_GRANT_STATUS, SUPPORT_GRANT_VALUES, type SupportGrantState } from "./supportGrant";
export { TARIFF_VERSION_STATUS, TARIFF_VERSION_VALUES, type TariffVersionState } from "./tariffVersion";
export { TEMPLATE_VERSION_STATUS, TEMPLATE_VERSION_VALUES, type TemplateVersionState } from "./templateVersion";
export { DSR_STATUS, DSR_VALUES, type DsrState } from "./dsr";
export { OUTBOX_STATUS, OUTBOX_VALUES, type OutboxState } from "./outbox";
export { CONSUMPTION_STATUS, CONSUMPTION_VALUES, type ConsumptionState } from "./consumption";
export { ROLLOUT_STATUS, ROLLOUT_VALUES, type RolloutStatus } from "./rollout";
export { OTA_DEVICE_STATUS, OTA_DEVICE_VALUES, type OtaDeviceStatus } from "./otaDevice";
export { TENANT_STATUS, TENANT_VALUES, type TenantStatus } from "./tenant";
export { BANK_ACCOUNT_STATUS, BANK_ACCOUNT_VALUES, type BankAccountState } from "./bankAccount";
export { MEMBERSHIP_STATUS, MEMBERSHIP_VALUES, type MembershipStatus } from "./membership";
export { INVOICE_DELIVERY_STATUS, INVOICE_DELIVERY_VALUES, type InvoiceDeliveryStatus } from "./invoiceDelivery";
export { ACCESS_RESULT_STATUS, ACCESS_RESULT_VALUES, type AccessResult } from "./accessResult";
export { PRIORITY_STATUS, PRIORITY_VALUES, type ServicePriority } from "./priority";
export { BOOKING_STATUS, BOOKING_VALUES, type BookingStatus } from "./booking";
export { CREDENTIAL_STATUS, CREDENTIAL_VALUES, type CredentialStatus } from "./credential";
export { PARCEL_STATUS, PARCEL_VALUES, type ParcelStatus } from "./parcel";

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
import { PLATFORM_INVOICE_STATUS } from "./platformInvoice";
import { CREDIT_NOTE_STATUS } from "./creditNote";
import { HAAS_STATUS } from "./haas";
import { INSTALL_ORDER_STATUS } from "./installOrder";
import { SITE_SURVEY_STATUS } from "./siteSurvey";
import { SUPPORT_GRANT_STATUS } from "./supportGrant";
import { TARIFF_VERSION_STATUS } from "./tariffVersion";
import { TEMPLATE_VERSION_STATUS } from "./templateVersion";
import { DSR_STATUS } from "./dsr";
import { OUTBOX_STATUS } from "./outbox";
import { CONSUMPTION_STATUS } from "./consumption";
import { ROLLOUT_STATUS } from "./rollout";
import { OTA_DEVICE_STATUS } from "./otaDevice";
import { TENANT_STATUS } from "./tenant";
import { BANK_ACCOUNT_STATUS } from "./bankAccount";
import { MEMBERSHIP_STATUS } from "./membership";
import { INVOICE_DELIVERY_STATUS } from "./invoiceDelivery";
import { ACCESS_RESULT_STATUS } from "./accessResult";
import { PRIORITY_STATUS } from "./priority";
import { BOOKING_STATUS } from "./booking";
import { CREDENTIAL_STATUS } from "./credential";
import { PARCEL_STATUS } from "./parcel";

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
  platformInvoice: PLATFORM_INVOICE_STATUS,
  creditNote: CREDIT_NOTE_STATUS,
  haas: HAAS_STATUS,
  installOrder: INSTALL_ORDER_STATUS,
  siteSurvey: SITE_SURVEY_STATUS,
  supportGrant: SUPPORT_GRANT_STATUS,
  tariffVersion: TARIFF_VERSION_STATUS,
  templateVersion: TEMPLATE_VERSION_STATUS,
  dsr: DSR_STATUS,
  outbox: OUTBOX_STATUS,
  consumption: CONSUMPTION_STATUS,
  rollout: ROLLOUT_STATUS,
  otaDevice: OTA_DEVICE_STATUS,
  tenant: TENANT_STATUS,
  bankAccount: BANK_ACCOUNT_STATUS,
  membership: MEMBERSHIP_STATUS,
  invoiceDelivery: INVOICE_DELIVERY_STATUS,
  accessResult: ACCESS_RESULT_STATUS,
  priority: PRIORITY_STATUS,
  booking: BOOKING_STATUS,
  credential: CREDENTIAL_STATUS,
  parcel: PARCEL_STATUS,
} as const;

export type StatusDomain = keyof typeof STATUS_MAPS;
