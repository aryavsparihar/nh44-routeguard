# Aadhaar Secure QR check (jsQR, BarcodeDetector, RSA)

**In one line:** a driver or agent scans the QR on their own Aadhaar card; the server checks UIDAI's digital signature and the name, and keeps only the result and the last 4 digits.

## What these are

- **Aadhaar Secure QR:** the QR code on Aadhaar cards and e-Aadhaar. It holds the card details plus a digital signature made with UIDAI's private key.
- **BarcodeDetector:** a browser feature that reads QR codes with the phone's camera (Chrome on Android has it).
- **jsQR** (1.4.0): a JavaScript QR reader we load only when the browser has no BarcodeDetector.
- **RSA-SHA256 signature:** maths that proves the data came from UIDAI and wasn't changed. We check it with Node's built-in `crypto`.

## Why we use it

- It proves a driver is a real person without anyone typing their Aadhaar number.
- It's free and offline-capable: no UIDAI API call, just the public certificate.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `src/ui/me/AadhaarCard.tsx` | Opens the camera (or a picture you choose), reads the QR on the phone, sends only its digits |
| `src/server/aadhaar/secure-qr.ts` | Pure functions: decode, unzip, check the signature, compare the name. No database, no logging |
| `src/server/aadhaar/keys.ts` | Loads the pinned public keys |
| `config/uidai/certs.json` | The pinned certificates, each with a SHA-256 fingerprint checked before use |
| `app/api/v1/verify/aadhaar-qr/` | The route (rate limit: 5 tries an hour) |
| `docs/demo/aadhaar-demo-qr.png` | A demo QR signed with **our own test key**, not UIDAI's |

## How it works in RouteGuard

1. The QR holds a very long decimal number. We turn it into bytes and unzip them (max 64 KB unzipped, to stop zip bombs).
2. The last 256 bytes are the signature. We check it against UIDAI's pinned public key.
3. We read the name field and compare it with the name on the account:
   - same after tidying (case, spaces, punctuation) → **verified**
   - other word order or one typo → **manual review**
   - otherwise → **rejected**
4. We save only the verdict, the **last 4 digits** and the certificate version.

The demo key only counts when `AADHAAR_ALLOW_TEST_CERT=true`.

## Our rules

- Never store or log the QR, name, date of birth, address or photo.
- Never ask anyone to type their Aadhaar number.

## Learn more

- https://uidai.gov.in/en/data-and-download (UIDAI's offline e-KYC certificates, where our pinned key comes from)
- https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector

## Questions you may be asked

**Q: Do you store Aadhaar numbers?**
A: No. Only the verdict, the last 4 digits and which certificate signed it. The QR itself is never stored or logged.

**Q: How do you know the QR is real and not a printed fake?**
A: It carries UIDAI's digital signature. Anyone can check it with UIDAI's public key, but only UIDAI can make it. Change one letter and the check fails.

**Q: Couldn't someone scan another person's card?**
A: The name in the QR must match the name on the account. And it only proves the card is real; it is advisory, like the rest of the app.

**Q: Is the demo QR a real Aadhaar?**
A: No. It's signed with our own test key, which only counts in demo mode. We say so wherever it is shown.

**Q: Do you call a UIDAI server?**
A: No. The check only needs UIDAI's public certificate, which we pin in the repo.
