// @instahealth/core — the single source of truth for all shared domain logic.
// Apps import ONLY from this barrel — never from deep paths.

// Types
export * from './types/helpers.types'
export * from './types/domain.types'

// Client factories
export * from './client/createClient'
export * from './client/createServiceClient'

// Business logic
export * from './business/preparation'
export * from './business/selection'
export * from './business/slots'
export * from './business/slot-sections'
export * from './business/pricing'
export * from './business/phone'
export * from './business/format'
export * from './business/geo'
export * from './business/hours'
export * from './business/payment'
export * from './business/payment-paytabs'
export * from './business/sms'

// Schemas
export * from './schemas/messages'
export * from './schemas/common.schema'
export * from './schemas/phone.schema'
export * from './schemas/auth.schema'
export * from './schemas/booking.schema'
export * from './schemas/payment.schema'
export * from './schemas/review.schema'

// Constants
export * from './constants'
