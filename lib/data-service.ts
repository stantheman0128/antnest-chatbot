/**
 * Data Service — barrel file re-exporting all database modules.
 *
 * All imports from "@/lib/data-service" continue to work.
 * Actual implementations are in:
 *   db-cache.ts       — shared cache infrastructure
 *   db-products.ts    — products CRUD + static fallback
 *   db-config.ts      — system config CRUD
 *   db-examples.ts    — conversation examples CRUD
 *   db-reservations.ts — pickup availability + reservations
 *   db-logging.ts     — LINE users, conversation logs, stats, customers
 */

export { invalidateAllCaches as invalidateCache } from "./db-cache";

export {
  type ProductVariant,
  type ProductCard,
  getActiveProducts,
  getAllProducts,
  getProductById,
  upsertProduct,
  deleteProduct,
} from "./db-products";

export {
  type SystemConfig,
  getConfigMap,
  getConfig,
  setConfig,
  deleteConfig,
  getAllConfigs,
} from "./db-config";

export {
  type ConversationExample,
  getActiveExamples,
  getAllExamples,
  upsertExample,
  deleteExample,
} from "./db-examples";

export {
  type PickupAvailability,
  type Reservation,
  getAvailableDates,
  getAllAvailabilities,
  getAvailabilityById,
  bulkCreateAvailabilities,
  deleteAvailability,
  createReservation,
  getAllReservations,
  updateReservationStatus,
  updateReservationNote,
  getReservationById,
  getLatestReservationByUser,
  getReservationsByUser,
  updateReservationOrderNumber,
  getConfirmedReservationsForCalendar,
} from "./db-reservations";

export {
  type LineUser,
  type ConversationLog,
  type ConversationStats,
  type CustomerWithContext,
  COMPLAINT_KEYWORDS,
  upsertLineUser,
  logConversation,
  getAllLineUsers,
  getConversationHistory,
  resolveIssue,
  getConversationStats,
  getCustomersWithContext,
  getCachedSummary,
  saveSummary,
} from "./db-logging";
