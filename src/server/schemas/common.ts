// zod building blocks every API schema reuses (rules from BUILD_PROMPT
// section 6). Use them inside z.object({...}).strict().
import { z } from "zod";

// C0 control characters and DEL. Tab and newline are allowed only in
// multi-line text (notes), never in names or short fields.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const CONTROL_CHARS_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000B-\u001F\u007F]/;

// User text: trimmed, Unicode NFC (so the same Hindi or Urdu word is always
// stored the same way), not empty, at most `max` characters, no control
// characters. The text is stored and shown as plain text, never as HTML.
export function cleanText(max: number, options: { multiline?: boolean } = {}) {
  const forbidden = options.multiline ? CONTROL_CHARS_EXCEPT_NEWLINE_TAB : CONTROL_CHARS;
  return z
    .string()
    .trim()
    .normalize("NFC")
    .min(1, "Can't be empty.")
    .max(max, `At most ${max} characters.`)
    .refine((text) => !forbidden.test(text), "Contains control characters.");
}

// Indian truck numbers. We remove spaces and dashes and uppercase first, so
// "jk 05 g 7712" becomes "JK05G7712".
//   State format:  2 letters (state), 1–2 digits (RTO), 0–3 letters, 4 digits
//   Bharat series: 2 digits (year), "BH", 4 digits, 1–2 letters
const STATE_FORMAT = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
const BHARAT_SERIES = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

export const truckNumber = z
  .string()
  .max(20, "Too long for a truck number.")
  .transform((raw) => raw.replace(/[\s-]/g, "").toUpperCase())
  .refine(
    (plate) => STATE_FORMAT.test(plate) || BHARAT_SERIES.test(plate),
    "Not a truck number. Use a format like JK05G7712 or 22BH1234AA.",
  );

// The NH-44 corridor box (section 6): about lat 32.6–34.2, lng 74.7–75.4.
const OUTSIDE = "outside the NH-44 corridor";
export const corridorLat = z.number().min(32.6, OUTSIDE).max(34.2, OUTSIDE);
export const corridorLng = z.number().min(74.7, OUTSIDE).max(75.4, OUTSIDE);

// List endpoints: ?limit=20&cursor=... (limit capped at 100).
export const pageQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(200).optional(),
  })
  .strict();
