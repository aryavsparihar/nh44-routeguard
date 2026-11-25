import { z } from "zod";

// ?zone=1..6 on public list routes. Anything else is a 400.
export const zoneParam = z.enum(["1", "2", "3", "4", "5", "6"]).transform(Number);
