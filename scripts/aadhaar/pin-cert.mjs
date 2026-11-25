#!/usr/bin/env node
// Pins a UIDAI signing certificate for the Aadhaar Secure QR check.
//
//   node scripts/aadhaar/pin-cert.mjs <certificate .cer or .pem> <version>
//   e.g. node scripts/aadhaar/pin-cert.mjs ~/Downloads/uidai_auth_sign_prod.cer uidai-2026
//
// Reads the certificate (DER or PEM), prints its subject, issuer, validity and
// SHA-256 fingerprint so you can compare them with UIDAI's page, and adds it
// to config/uidai/certs.json as a real (test: false) key. Download the
// certificate only from https://uidai.gov.in/en/data-and-download. Runbook: docs/runbook.md, "Aadhaar QR".
import { createHash, createPublicKey, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [file, version] = process.argv.slice(2);
if (!file || !version || !/^[a-z0-9-]{3,40}$/.test(version)) {
  console.error("Usage: node scripts/aadhaar/pin-cert.mjs <cert file> <version, e.g. uidai-2026>");
  process.exit(2);
}

const cert = new X509Certificate(readFileSync(file));
const pem = cert.toString();
if (createPublicKey(pem).asymmetricKeyType !== "rsa") throw new Error("Expected an RSA certificate.");
console.log(`Subject:  ${cert.subject.replace(/\n/g, ", ")}`);
console.log(`Issuer:   ${cert.issuer.replace(/\n/g, ", ")}`);
console.log(`Valid:    ${cert.validFrom} → ${cert.validTo}`);
console.log(`SHA-256 of the certificate: ${cert.fingerprint256}`);

const path = new URL("../../config/uidai/certs.json", import.meta.url);
const json = JSON.parse(readFileSync(path, "utf8"));
if (json.certificates.some((c) => c.version === version)) throw new Error(`${version} is already pinned.`);
json.certificates.push({
  version,
  test: false,
  sha256: createHash("sha256").update(pem).digest("hex"),
  pem,
  note: `UIDAI certificate, valid ${cert.validFrom} to ${cert.validTo}. Pinned with scripts/aadhaar/pin-cert.mjs.`,
});
writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
console.log(`Pinned ${version} in config/uidai/certs.json. Commit it, then run npm test.`);
