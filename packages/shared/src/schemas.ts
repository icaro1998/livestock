import { z } from "zod";
import { MAX_PAGE_SIZE } from "./constants";
import { Role } from "./roles";

const dateLike = z.union([z.string().datetime({ offset: true }).or(z.string()), z.date()]);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.custom<Role>((val) => val === "admin" || val === "manager" || val === "viewer", {
    message: "role must be admin|manager|viewer",
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const animalCreateSchema = z.object({
  uid: z.string().min(1),
  eid: z.string().optional(),
  vid: z.string().optional(),
  registration_at: dateLike.optional(),
  alert: z.boolean().optional(),
  race: z.string().optional(),
  sex: z.string().optional(),
  color: z.string().optional(),
  mother_name: z.string().optional(),
  father_name: z.string().optional(),
  brand_mark: z.string().optional(),
  birth_year: z.number().int().optional(),
  birth_month: z.number().int().min(1).max(12).optional(),
  birth_place: z.string().optional(),
  diagnostic: z.string().optional(),
  warning: z.string().optional(),
  notes: z.string().optional(),
});

export const animalPatchSchema = animalCreateSchema.partial().extend({
  alert: z.boolean().optional(),
});

const dimensionCodes = z.object({
  location_from_code: z.string().optional(),
  location_to_code: z.string().optional(),
  group_code: z.string().optional(),
  party_code: z.string().optional(),
  product_code: z.string().optional(),
});

export const eventBaseSchema = z.object({
  uid: z.string().min(1),
  event_at: dateLike,
  event_type: z.string().min(1),
  event_subtype: z.string().optional(),
  source_ref: z.string().optional(),
  batch_id: z.string().optional(),
  confidence: z.number().optional(),
  notes: z.string().optional(),
  payload: z.record(z.any()).optional(),
}).merge(dimensionCodes);

export const weightFields = z.object({
  weight_kg: z.number().optional(),
  method: z.string().optional(),
  shrink_pct: z.number().optional(),
});

export const movementFields = z.object({
  reason: z.string().optional(),
  distance_km: z.number().optional(),
  transport_party_code: z.string().optional(),
});

export const reproFields = z.object({
  repro_action: z.string().optional(),
  sire_uid: z.string().optional(),
  dam_uid: z.string().optional(),
  result: z.string().optional(),
  calf_uid: z.string().optional(),
  gestation_days: z.number().int().optional(),
});

export const healthFields = z.object({
  action: z.string().optional(),
  diagnosis: z.string().optional(),
  dose: z.number().optional(),
  dose_unit: z.string().optional(),
  withdrawal_days: z.number().int().optional(),
});

export const nutritionFields = z.object({
  ration_code: z.string().optional(),
  intake_kg_day: z.number().optional(),
  supplement_code: z.string().optional(),
  reason: z.string().optional(),
});

export const eventCreateSchema = eventBaseSchema
  .extend({
    event_type: z.enum([
      "weight",
      "movement",
      "repro",
      "health",
      "nutrition",
      "inventory",
      "management",
      "diagnostic",
      "environment",
    ]),
  })
  .and(weightFields.partial())
  .and(movementFields.partial())
  .and(reproFields.partial())
  .and(healthFields.partial())
  .and(nutritionFields.partial());

export const bulkEventsSchema = z.object({ events: z.array(eventCreateSchema).min(1) });

export const costCreateSchema = z
  .object({
    cost_at: dateLike,
    scope: z.enum(["animal", "group", "location", "ranch", "batch"]),
    uid: z.string().optional(),
    group_code: z.string().optional(),
    location_code: z.string().optional(),
    category: z.enum(["feed", "health", "labor", "transport", "capex", "misc"]),
    product_code: z.string().optional(),
    party_code: z.string().optional(),
    amount: z.number(),
    currency: z.string().default("BOB"),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    source_ref: z.string().optional(),
    batch_id: z.string().optional(),
    notes: z.string().optional(),
  })
  .and(z.object({ payload: z.record(z.any()).optional() }).partial());

export const bulkCostsSchema = z.object({ costs: z.array(costCreateSchema).min(1) });

export const dimensionCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().max(MAX_PAGE_SIZE).optional(),
  cursor: z.string().optional(),
});

export const animalsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  min_age_months: z.coerce.number().int().optional(),
  max_age_months: z.coerce.number().int().optional(),
  min_weight: z.coerce.number().optional(),
  max_weight: z.coerce.number().optional(),
  brand_mark: z.string().optional(),
  last_event_type: z.string().optional(),
  location_code: z.string().optional(),
  from: dateLike.optional(),
  to: dateLike.optional(),
});

export const eventsQuerySchema = paginationSchema.extend({
  uid: z.string().optional(),
  event_type: z.string().optional(),
  from: dateLike.optional(),
  to: dateLike.optional(),
  location_code: z.string().optional(),
  group_code: z.string().optional(),
  batch_id: z.string().optional(),
});

export const exportAnimalsQuerySchema = animalsQuerySchema.extend({
  format: z.enum(["json", "csv"]).optional(),
});

export const exportEventsQuerySchema = eventsQuerySchema.extend({
  format: z.enum(["json", "csv"]).optional(),
  include_payload: z.coerce.boolean().optional(),
});

export const exportCostsQuerySchema = paginationSchema.extend({
  format: z.enum(["json", "csv"]).optional(),
  scope: z.string().optional(),
  uid: z.string().optional(),
  category: z.string().optional(),
  batch_id: z.string().optional(),
  from: dateLike.optional(),
  to: dateLike.optional(),
});

export const exportDimensionsQuerySchema = z.object({
  format: z.enum(["json", "csv"]).optional(),
  table: z.enum(["location", "herdGroup", "party", "product"]).optional(),
});
