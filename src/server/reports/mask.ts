// Notes are about the road, not people (BUILD_PROMPT section 10): phone
// numbers and vehicle numbers in a note are masked before it is saved.
// The mask keeps the note readable ("Truck ••• stuck at Digdol").
export const MASK = "•••";

// Indian mobile numbers with or without +91 / 0, and any run of 10 or more
// digits (with spaces or dashes between them).
const PHONE = /(?:\+?91[\s-]*|\b0)?[6-9](?:[\s-]*\d){9}\b|\b\d(?:[\s-]*\d){9,}\b/g;

// Vehicle registrations: "JK 05 G 7712", "jk05g7712", "JK-02-CD-1234", and
// the Bharat series "22 BH 1234 AA".
const PLATE = /\b[A-Za-z]{2}[\s-]*\d{1,2}[\s-]*[A-Za-z]{0,3}[\s-]*\d{4}\b|\b\d{2}[\s-]*BH[\s-]*\d{4}[\s-]*[A-Za-z]{1,2}\b/gi;

export function maskNote(note: string): string {
  return note.replace(PLATE, MASK).replace(PHONE, MASK);
}
