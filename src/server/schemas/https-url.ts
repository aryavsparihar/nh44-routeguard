import { z } from "zod";

// A source link that people will open from the app: https only, no user name
// or password in it, at most 500 characters. Stored and shown as text in an
// <a href>, never as HTML. "javascript:" and "http:" links fail here, and the
// database checks the https:// prefix again (official_updates, road_status).
export const httpsUrl = z
  .string()
  .trim()
  .max(500, "At most 500 characters.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.username === "" && url.password === "" && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Must be a full https:// link to where this was published.");
