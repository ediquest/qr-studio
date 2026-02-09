// src/config/symbologies.js
// Popular barcode presets for the studio UI.
// Each entry defines the BWIPP 'bcid' and basic input hints/validation.

export const SYMBOLOGIES = [
  { id: "ean13",   label: "EAN‑13",    bcid: "ean13",    placeholder: "5901234123457",      pattern: /^[0-9]{12,13}$/ },
  { id: "ean8",    label: "EAN‑8",     bcid: "ean8",     placeholder: "12345670",           pattern: /^[0-9]{7,8}$/ },
  { id: "code128", label: "Code 128",   bcid: "code128",  placeholder: "ABC123-xyz",         pattern: /^[\x00-\x7F]{1,100}$/ },
  { id: "itf14",   label: "ITF‑14",    bcid: "itf14",    placeholder: "1234567890123",      pattern: /^[0-9]{13,14}$/ },
  { id: "gs1-128", label: "GS1‑128",   bcid: "gs1-128",  placeholder: "(01)05901234123457", pattern: /^[\x00-\x7F]{1,200}$/ },
  { id: "qrcode",  label: "QR Code",    bcid: "qrcode",   placeholder: "https://example.com", pattern: /^[\s\S]{1,1500}$/ },
  { id: "datamatrix", label: "Data Matrix", bcid: "datamatrix", placeholder: "DM DATA",        pattern: /^[\s\S]{1,1500}$/ },
  { id: "pdf417",  label: "PDF417",     bcid: "pdf417",   placeholder: "PDF417 DATA",        pattern: /^[\s\S]{1,1800}$/ },
  { id: "azteccode", label: "Aztec",    bcid: "azteccode", placeholder: "AZTEC DATA",         pattern: /^[\s\S]{1,1500}$/ },
];

// Optional: default renderer options per symbology
export const DEFAULT_OPTS = {
  includetext: true,
  textxalign: "center",
  scale: 3,
  height: 12, // mm-equivalent-ish depending on DPI
  padding: 0
};

export function normalizeInput(symId, value) {
  let v = (value||"").toString().trim();
  // remove common separators for numeric symbologies
  if (["ean13","ean8","itf14"].includes(symId)) {
    v = v.replace(/[^0-9]/g,"");
  }
  return v;
}
