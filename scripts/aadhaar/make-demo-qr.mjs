// A synthetic Aadhaar Secure QR for the demo (BUILD_PROMPT section 11).
//
//   node scripts/aadhaar/make-demo-qr.mjs
//
// Makes a new RSA key pair, signs a QR in the Secure QR layout for the demo
// driver ("Demo driver (not vouched)", last 4 digits 0000, no photo), and:
//   * pins the PUBLIC key in config/uidai/certs.json as a test certificate
//     (accepted only when AADHAAR_ALLOW_TEST_CERT=true; the badge then says
//     "Demo check (test key)");
//   * writes docs/demo/aadhaar-demo-qr.png to show on a laptop screen and
//     scan with the phone.
// The private key is never written anywhere. No real person's data is used,
// and no real Aadhaar card is scanned on stage or in screenshots.
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import QRCode from "qrcode";

const VERSION = "routeguard-test-2026-11";
const CERTS = "config/uidai/certs.json";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

// V2 layout: version, email/mobile indicator (0 = neither), reference id
// (last 4 digits + timestamp), name, date of birth, gender, then address.
const fields = [
  "V2", "0", "0000" + "20261125120000000", "Demo driver (not vouched)", "01-01-1990", "M",
  "", "Ramban", "", "", "", "182144", "", "Jammu and Kashmir", "", "", "",
];
const SEP = Buffer.from([255]);
const text = Buffer.concat(fields.flatMap((f) => [Buffer.from(f, "utf8"), SEP]));
const signature = sign("sha256", text, privateKey);
const qr = BigInt("0x" + gzipSync(Buffer.concat([text, signature])).toString("hex")).toString(10);

const certs = fs.existsSync(CERTS) ? JSON.parse(fs.readFileSync(CERTS, "utf8")) : { _note: "", certificates: [] };
certs.certificates = certs.certificates.filter((c) => !c.test);
certs.certificates.push({
  version: VERSION,
  test: true,
  note: "RouteGuard demo key made by scripts/aadhaar/make-demo-qr.mjs. Not a UIDAI certificate.",
  sha256: createHash("sha256").update(pem).digest("hex"),
  pem,
});
fs.writeFileSync(CERTS, JSON.stringify(certs, null, 2) + "\n");

fs.mkdirSync("docs/demo", { recursive: true });
await QRCode.toFile("docs/demo/aadhaar-demo-qr.png", qr, { errorCorrectionLevel: "M", margin: 2, width: 720 });
console.log(`demo QR: ${qr.length} digits → docs/demo/aadhaar-demo-qr.png; public key pinned as ${VERSION}`);
