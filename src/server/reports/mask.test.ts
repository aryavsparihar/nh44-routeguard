import { describe, expect, it } from "vitest";
import { MASK, maskNote } from "./mask";

describe("maskNote", () => {
  it.each([
    ["Call 9876543210 for help", `Call ${MASK} for help`],
    ["Call +91 98765 43210", `Call ${MASK}`],
    ["Call 098765-43210", `Call ${MASK}`],
    ["Truck JK 05 G 7712 stuck", `Truck ${MASK} stuck`],
    ["truck jk05g7712 stuck", `truck ${MASK} stuck`],
    ["JK-02-CD-1234 on its side", `${MASK} on its side`],
    ["22 BH 1234 AA blocking", `${MASK} blocking`],
  ])("masks %s", (input, expected) => expect(maskNote(input)).toBe(expected));

  it.each([
    "Stones on the road near km 123",
    "Water 30 cm deep, 2 lanes shut",
    "Since 14:30, about 200 trucks waiting",
    "Digdol, near tunnel T5",
  ])("leaves road facts alone: %s", (input) => expect(maskNote(input)).toBe(input));
});
