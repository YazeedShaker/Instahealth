// Convenience aliases over the generated database types.
// The generic helpers (Tables<'bookings'>, TablesInsert<...>, …) come from database.ts;
// this file re-exports them and names the rows features use constantly.
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from './database'

import type { Tables } from './database'

export type UserRow = Tables<'users'>
export type ProviderRow = Tables<'providers'>
export type BranchRow = Tables<'branches'>
export type ServiceCategoryRow = Tables<'service_categories'>
export type ServiceRow = Tables<'services'>
export type BranchServiceRow = Tables<'branch_services'>
export type SlotRow = Tables<'slots'>
export type SlotHoldRow = Tables<'slot_holds'>
export type BookingRow = Tables<'bookings'>
export type BookingServiceRow = Tables<'booking_services'>
export type PaymentRow = Tables<'payments'>
export type ReviewRow = Tables<'reviews'>
export type NotificationRow = Tables<'notifications'>
