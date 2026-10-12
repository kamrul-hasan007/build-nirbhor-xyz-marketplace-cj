import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  phoneNumber: text('phoneNumber').unique(),
  phoneNumberVerified: boolean('phoneNumberVerified').notNull().default(false),
  phone: text('phone'),
  role: text('role').notNull().default('customer'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
})

export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const areas = pgTable('areas', {
  id: text('id').primaryKey(),
  cityId: text('city_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  codEnabled: boolean('cod_enabled').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  coverageGeojson: jsonb('coverage_geojson'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const serviceCategories = pgTable('service_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  cityIds: jsonb('city_ids').notNull().default([]),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
})

export const packages = pgTable('packages', {
  id: text('id').primaryKey(),
  serviceId: text('service_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceBdt: integer('price_bdt').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  inclusions: jsonb('inclusions').notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
})

export const addresses = pgTable('addresses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  label: text('label').notNull(),
  addressLine: text('address_line').notNull(),
  areaId: text('area_id').notNull(),
  cityId: text('city_id').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const carts = pgTable('carts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  cityId: text('city_id').notNull(),
  areaId: text('area_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const cartItems = pgTable('cart_items', {
  id: text('id').primaryKey(),
  cartId: text('cart_id').notNull(),
  packageId: text('package_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  addressId: text('address_id').notNull(),
  providerId: text('provider_id'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('REQUESTED'),
  paymentMethod: text('payment_method').notNull(),
  subtotalBdt: integer('subtotal_bdt').notNull(),
  discountBdt: integer('discount_bdt').notNull().default(0),
  totalBdt: integer('total_bdt').notNull(),
  advanceDueBdt: integer('advance_due_bdt').notNull().default(0),
  cancellationFeeBdt: integer('cancellation_fee_bdt').notNull().default(0),
  promoCode: text('promo_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const bookingItems = pgTable('booking_items', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  packageId: text('package_id').notNull(),
  serviceId: text('service_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceBdt: integer('unit_price_bdt').notNull(),
  lineTotalBdt: integer('line_total_bdt').notNull(),
})

export const bookingStatusLogs = pgTable('booking_status_logs', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const providerProfiles = pgTable('provider_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('PENDING'),
  availability: text('availability').notNull().default('unavailable'),
  nidDocumentUrl: text('nid_document_url'),
  documentUrls: jsonb('document_urls').notNull().default([]),
  payoutDetails: jsonb('payout_details').notNull().default({}),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const providerServices = pgTable('provider_services', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  serviceId: text('service_id').notNull(),
  proposedChargeBdt: integer('proposed_charge_bdt').notNull(),
  approvedChargeBdt: integer('approved_charge_bdt'),
  isApproved: boolean('is_approved').notNull().default(false),
})

export const promos = pgTable('promos', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  maxDiscountBdt: integer('max_discount_bdt'),
  minOrderBdt: integer('min_order_bdt').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  usageLimit: integer('usage_limit'),
  isActive: boolean('is_active').notNull().default(true),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const commissionSettings = pgTable('commission_settings', {
  id: text('id').primaryKey(),
  rateBasisPoints: integer('rate_basis_points').notNull(),
  advanceThresholdBdt: integer('advance_threshold_bdt').notNull(),
  advancePercent: integer('advance_percent').notNull(),
  freeCancellationHours: integer('free_cancellation_hours').notNull(),
  lateCancellationPercent: integer('late_cancellation_percent').notNull(),
  providerResponseMinutes: integer('provider_response_minutes').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const adminProfiles = pgTable('admin_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  subRole: text('sub_role').notNull().default('support'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  userId: text('user_id').notNull(),
  amountBdt: integer('amount_bdt').notNull(),
  method: text('method').notNull(),
  status: text('status').notNull().default('PENDING'),
  gatewayReference: text('gateway_reference'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const commissions = pgTable('commissions', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  providerId: text('provider_id').notNull(),
  rateBasisPoints: integer('rate_basis_points').notNull(),
  amountBdt: integer('amount_bdt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const providerDuesLedger = pgTable('provider_dues_ledger', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  bookingId: text('booking_id'),
  entryType: text('entry_type').notNull(),
  amountBdt: integer('amount_bdt').notNull(),
  balanceAfterBdt: integer('balance_after_bdt').notNull(),
  memo: text('memo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const payouts = pgTable('payouts', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  amountBdt: integer('amount_bdt').notNull(),
  status: text('status').notNull().default('REQUESTED'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  approvedBy: text('approved_by'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  reference: text('reference'),
})

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().unique(),
  userId: text('user_id').notNull(),
  providerId: text('provider_id').notNull(),
  rating: integer('rating').notNull(),
  body: text('body').notNull().default(''),
  status: text('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const complaints = pgTable('complaints', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  userId: text('user_id').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('OPEN'),
  refundId: text('refund_id'),
  assignedTo: text('assigned_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  channel: text('channel').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('QUEUED'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const schema = {
  user,
  session,
  account,
  verification,
  cities,
  areas,
  serviceCategories,
  services,
  packages,
  addresses,
  carts,
  cartItems,
  bookings,
  bookingItems,
  bookingStatusLogs,
  providerProfiles,
  providerServices,
  promos,
  settings,
  commissionSettings,
  adminProfiles,
  payments,
  commissions,
  providerDuesLedger,
  payouts,
  reviews,
  complaints,
  notifications,
}

export const bookingTransitions: Record<string, readonly string[]> = {
  REQUESTED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'NOT_RESPONDED', 'CANCELLED'],
  ACCEPTED: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['STARTED'],
  STARTED: ['COMPLETED'],
  COMPLETED: ['PAID', 'REFUNDED'],
  PAID: ['REFUNDED'],
  REJECTED: ['ASSIGNED', 'CANCELLED'],
  NOT_RESPONDED: ['ASSIGNED', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
}

export const adminRoles = ['super_admin', 'operations', 'support', 'finance'] as const
export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount)
export const createId = (prefix = 'nrb') => `${prefix}_${crypto.randomUUID()}`
export const isBangladeshMobile = (phone: string) => /^\+8801[3-9]\d{8}$/.test(phone)
export const packageInclusions = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
export const canTransitionBooking = (from: string, to: string) => bookingTransitions[from]?.includes(to) ?? false
export const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'] as const

export type UserRole = 'customer' | 'provider' | (typeof adminRoles)[number]
export type BookingStatus = keyof typeof bookingTransitions
export type AdminSubRole = (typeof adminRoles)[number]
export type PaymentMethod = 'COD' | 'ONLINE' | 'MFS' | 'CARD'

export const supportedCities = ['dhaka', 'chattogram'] as const
export const currencyCode = 'BDT'
export const defaultAdvancePolicy = { thresholdBdt: 5000, percent: 20 }
export const defaultCancellationPolicy = { freeHours: 24, feePercent: 10 }
export const defaultCommissionRateBps = 1500
export const defaultProviderResponseMinutes = 20
export const isAdminRole = (role: string) => adminRoles.includes(role as AdminSubRole)
export const bookingStatusLabels: Record<string, string> = {
  REQUESTED: 'Requested',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  ON_THE_WAY: 'On the way',
  STARTED: 'Started',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  NOT_RESPONDED: 'Not responded',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export type City = typeof cities.$inferSelect
export type Area = typeof areas.$inferSelect
export type Service = typeof services.$inferSelect
export type Package = typeof packages.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type Address = typeof addresses.$inferSelect
export type ProviderProfile = typeof providerProfiles.$inferSelect
export type User = typeof user.$inferSelect
export type Review = typeof reviews.$inferSelect
export type Complaint = typeof complaints.$inferSelect
export type Payout = typeof payouts.$inferSelect
export type Commission = typeof commissions.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type CartItem = typeof cartItems.$inferSelect
export type ProviderLedgerEntry = typeof providerDuesLedger.$inferSelect
export type Setting = typeof settings.$inferSelect
