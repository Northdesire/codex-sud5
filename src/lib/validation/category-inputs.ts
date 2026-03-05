import { z } from "zod";

const money = z.coerce.number().finite().min(0);
const positiveMoney = z.coerce.number().finite().gt(0);

const optionalText = z
  .string()
  .trim()
  .max(400)
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalShortText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

export const produktPayloadSchema = z.object({
  name: z.string().trim().min(2, "Produktname ist zu kurz").max(160, "Produktname ist zu lang"),
  kategorie: z.string().trim().min(1, "Kategorie ist erforderlich").max(80, "Kategorie ist zu lang"),
  artikelNr: optionalShortText,
  beschreibung: optionalText,
  ekPreis: money,
  vkPreis: money,
  einheit: z.string().trim().min(1).max(20).default("Stk."),
  aktiv: z.boolean().optional().default(true),
});

const unterkunftTypSchema = z.enum([
  "EINZELZIMMER",
  "DOPPELZIMMER",
  "SUITE",
  "FERIENWOHNUNG",
  "BENUTZERDEFINIERT",
]);

const gastPreiseSchema = z
  .record(z.string(), z.coerce.number().finite().min(0))
  .optional()
  .nullable()
  .transform((v) => (v && Object.keys(v).length > 0 ? v : null));

const saisonPreisSchema = z.object({
  saisonId: z.string().trim().min(1, "Saison-ID fehlt"),
  preisProNacht: positiveMoney,
  gastPreise: gastPreiseSchema,
});

export const unterkunftPayloadSchema = z
  .object({
    name: z.string().trim().min(2, "Unterkunftsname ist zu kurz").max(160, "Unterkunftsname ist zu lang"),
    beschreibung: optionalText,
    typ: unterkunftTypSchema.default("FERIENWOHNUNG"),
    kapazitaet: z.coerce.number().int().min(1, "Kapazität muss mindestens 1 sein").max(40, "Kapazität ist zu hoch"),
    preisProNacht: positiveMoney,
    gastPreise: gastPreiseSchema,
    aktiv: z.boolean().optional().default(true),
    komplexId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    icalUrl: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null))
      .refine((v) => !v || v.startsWith("http://") || v.startsWith("https://"), {
        message: "iCal-URL muss mit http:// oder https:// beginnen",
      }),
    saisonPreise: z.array(saisonPreisSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const item of data.saisonPreise) {
      if (ids.has(item.saisonId)) {
        ctx.addIssue({
          code: "custom",
          message: "Saison darf nur einmal pro Unterkunft vorkommen",
          path: ["saisonPreise"],
        });
        break;
      }
      ids.add(item.saisonId);
    }
  });

const fahrradPreisSchema = z.object({
  tag: z.coerce.number().int().min(1, "Tag muss mindestens 1 sein").max(365, "Tag darf maximal 365 sein"),
  gesamtpreis: money,
});

export const fahrradPayloadSchema = z
  .object({
    name: z.string().trim().min(2, "Fahrradname ist zu kurz").max(160, "Fahrradname ist zu lang"),
    kategorie: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : "Allgemein")),
    beschreibung: optionalText,
    aktiv: z.boolean().optional().default(true),
    preisProWeitererTag: z
      .union([z.coerce.number().finite().min(0), z.null(), z.undefined(), z.literal("")])
      .transform((v) => (v === "" || v == null ? null : v)),
    preise: z.array(fahrradPreisSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<number>();
    for (const item of data.preise) {
      if (seen.has(item.tag)) {
        ctx.addIssue({
          code: "custom",
          message: "Jeder Miettag darf nur einmal vorkommen",
          path: ["preise"],
        });
        break;
      }
      seen.add(item.tag);
    }
  });

export function parsePayload<T>(schema: z.ZodSchema<T>, input: unknown):
  | { success: true; data: T }
  | { success: false; error: string } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const issue = parsed.error.issues[0];
  return { success: false, error: issue?.message ?? "Ungültige Eingabedaten" };
}
