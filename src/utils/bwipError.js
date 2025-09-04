// src/utils/bwipError.js
// Robust cleaner + PL localization for bwip-js error messages.

/**
 * Normalize and translate bwip-js/BWIPP errors to user-friendly Polish.
 * Examples input:
 *  "bwipp.ean13badLength#4907: EAN-13 must be 12 or 13 digits"
 *  "Error: bwip-js.code128badCharacter: Invalid character"
 *  "Błąd: bwipp.ean8badLength: EAN-8 must be 7 or 8 digits"
 *
 * Output:
 *  "EAN‑13 musi mieć 12 lub 13 cyfr"
 */
export function cleanBwipError(err, { fallback = "Nieprawidłowe dane dla wybranego standardu." } = {}) {
  const raw = (err && (err.message || err) || "") + "";
  // pick error code if present
  const codeMatch = raw.match(/(?:bwipp|bwip-js)[.:]([\w-]+)(?:#\d+)?:\s*/i);
  const code = codeMatch && codeMatch[1] ? codeMatch[1].toLowerCase() : null;

  // strip leading framework prefixes & trailing stacks
  let s = raw
    .replace(/^(?:błąd|blad|error)\s*:\s*/i, "")
    .replace(/(?:bwipp|bwip-js)[.:][\w-]+(?:#\d+)?:\s*/ig, "")
    .replace(/\s+at\s+[\s\S]*$/g, "")
    .trim();

  // If nothing meaningful left, use fallback
  if (!s) s = fallback;

  // Try dictionary mapping by code first
  const dict = {
    // lengths
    "ean13badlength": "EAN‑13 musi mieć 12 lub 13 cyfr",
    "ean8badlength": "EAN‑8 musi mieć 7 lub 8 cyfr",
    "upcabadlength": "UPC‑A musi mieć 11 lub 12 cyfr",
    "upcebadlength": "UPC‑E musi mieć 6, 7 lub 8 cyfr",
    "itf14badlength": "ITF‑14 musi mieć 13 lub 14 cyfr",
    "isbn10badlength": "ISBN‑10 musi mieć 9 lub 10 cyfr (bez myślników)",
    "isbn13badlength": "ISBN‑13 musi mieć 12 lub 13 cyfr (bez myślników)",

    // character sets
    "code39badcharacter": "Code 39 zawiera niedozwolony znak",
    "code128badcharacter": "Code 128 zawiera niedozwolony znak",
    "itfbadcharacter": "ITF (Interleaved 2 of 5) akceptuje tylko cyfry",
    "postnetbadcharacter": "POSTNET akceptuje tylko cyfry",

    // checksums
    "badcheckdigit": "Nieprawidłowa cyfra kontrolna",
    "badchecksum": "Nieprawidłowa suma kontrolna",

    // capacity/size
    "qrcodetoolong": "Zbyt dużo danych dla wersji QR Code",
    "datamatrixtoolong": "Zbyt dużo danych dla Data Matrix",
    "pdf417toolong": "Zbyt dużo danych dla PDF417",
  };

  if (code && dict[code]) {
    return dict[code];
  }

  // Fallback: heuristic localization of common English phrases
  let pl = s;
  pl = pl.replace(/\bmust be\b/gi, "musi mieć");
  pl = pl.replace(/\bshould be\b/gi, "powinno mieć");
  pl = pl.replace(/\bdigit(s)?\b/gi, "cyfr");
  pl = pl.replace(/\binvalid\b/gi, "nieprawidłowy");
  pl = pl.replace(/\btoo long\b/gi, "za długi");
  pl = pl.replace(/\btoo short\b/gi, "za krótki");
  pl = pl.replace(/\bcharacters?\b/gi, "znaków");
  pl = pl.replace(/\balphanumeric\b/gi, "alfanumeryczne");
  pl = pl.replace(/\bchecksum\b/gi, "suma kontrolna");
  pl = pl.replace(/\bvalue\b/gi, "wartość");

  // Capitalize EAN/UPC/GS1 names correctly if present
  pl = pl.replace(/\bean\s*-?\s*(\d{1,2})\b/ig, (m, g1) => `EAN-${g1}`);
  pl = pl.replace(/\bupc\s*-?\s*a\b/ig, "UPC-A");
  pl = pl.replace(/\bupc\s*-?\s*e\b/ig, "UPC-E");
  pl = pl.replace(/\bgs1\s*-?\s*128\b/ig, "GS1‑128");

  // ensure final punctuation removed
  pl = pl.replace(/[.:\s]+$/,"").trim();
  return pl || fallback;
}
