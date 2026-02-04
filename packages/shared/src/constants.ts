export const WS_TOPICS = {
  animalUpdated: "animal.updated",
  eventCreated: "event.created",
  costCreated: "cost.created",
  dimensionUpdated: "dimension.updated",
} as const;

export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
