// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PKPass } from "npm:passkit-generator@3.4.0";
import forge from "npm:node-forge@1.3.1";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const privacyURL = "https://scampagnate.com/privacy";
const websiteURL = "https://scampagnate.com";
const logoURL = "https://scampagnate.com/apple-touch-icon.png";
const associationName = "ASD Gruppo Scampagnate";
const primary = [34, 80, 56];
const primaryDeep = [18, 56, 36];
const primaryDark = [15, 42, 28];
const cream = [255, 245, 216];
const gold = [246, 193, 106];
let cachedLogoBuffer = null;
let cachedLogoPNG = null;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Metodo non supportato");

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) throw new HttpError(401, "Accesso richiesto");

    const config = readPassConfig();
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new HttpError(401, "Sessione non valida");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,email,membership_id,membership_status,membership_year,membership_registration_date")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error("Wallet profile fetch failed", profileError);
      throw new HttpError(404, "Profilo non trovato");
    }

    const pass = await buildMembershipPass(config, profile, authData.user.email);
    return new Response(pass, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": "attachment; filename=scampagnate-tessera.pkpass",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Non siamo riusciti a generare la tessera Wallet";
    console.error("generate-wallet-pass-v2", error);
    return jsonError(status, message);
  }
});

async function buildMembershipPass(config, profile, userEmail) {
  const membership = validateMembership(profile);
  const fullName = displayName(profile) || userEmail || "Socio Scampagnate";
  const registrationDate = formatItalianDate(profile.membership_registration_date);
  const logoBuffer = await loadLogoBuffer();
  const logoPNG = await loadLogoPNG();
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: config.description,
    serialNumber: `membership-${membership.id}`,
    logoText: "Scampagnate",
    sharingProhibited: false,
    suppressStripShine: true,
    backgroundColor: "rgb(34, 80, 56)",
    foregroundColor: "rgb(255, 245, 216)",
    labelColor: "rgb(246, 193, 106)",
    expirationDate: membership.expirationDate.toISOString(),
    userInfo: { user_id: profile.id, membership_id: membership.id, membership_year: membership.year },
    storeCard: {
      primaryFields: [{ key: "member", label: "TESSERA SOCIO", value: fullName }],
      secondaryFields: [
        { key: "membership_id", label: "Tessera", value: `n.${membership.id}` },
        { key: "expires", label: "Valida fino al", value: membership.expiryLabel },
      ],
      auxiliaryFields: [{ key: "association", label: "ASD", value: "Gruppo Scampagnate" }],
      backFields: [
        { key: "back_member", label: "Intestatario", value: fullName },
        { key: "back_membership_id", label: "Numero tessera", value: `#${membership.id}` },
        { key: "back_year", label: "Anno associativo", value: `${membership.year}` },
        { key: "back_registration", label: "Membro dal", value: registrationDate ?? "N/D" },
        { key: "back_association", label: "Associazione", value: associationName },
        { key: "back_coverage", label: "Copertura", value: "Valida durante le attivita sociali previste dalla tessera." },
        { key: "back_website", label: "Sito", value: websiteURL, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
        { key: "back_privacy", label: "Privacy", value: privacyURL, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
      ],
    },
  };

  const certificates = await loadCertificates(config);
  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": makeIconPNG(29),
      "icon@2x.png": makeIconPNG(58),
      "icon@3x.png": makeIconPNG(87),
      "logo.png": logoBuffer,
      "logo@2x.png": logoBuffer,
      "logo@3x.png": logoBuffer,
      "strip.png": makeStripPNG(logoPNG, 375, 123),
      "strip@2x.png": makeStripPNG(logoPNG, 750, 246),
      "strip@3x.png": makeStripPNG(logoPNG, 1125, 369),
    },
    certificates,
  );
  return pass.getAsBuffer();
}

function readPassConfig() {
  return {
    teamIdentifier: requireEnv("PASSKIT_TEAM_ID"),
    passTypeIdentifier: requireEnv("PASSKIT_PASS_TYPE_ID"),
    organizationName: normalizedAssociationName(Deno.env.get("PASSKIT_ORGANIZATION_NAME")),
    description: Deno.env.get("PASSKIT_DESCRIPTION") || "Tessera socio ASD Gruppo Scampagnate",
    certificateP12Base64: requireEnv("PASSKIT_CERTIFICATE_P12_BASE64"),
    certificatePassword: requireEnv("PASSKIT_CERTIFICATE_PASSWORD"),
  };
}

function normalizedAssociationName(value) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned === "ASD Scampagnate" || cleaned === "Scampagnate") return associationName;
  return cleaned;
}

function validateMembership(profile) {
  const id = Number(profile.membership_id);
  if (!Number.isFinite(id) || id <= 0) throw new HttpError(403, "Tessera non disponibile");
  if (String(profile.membership_status ?? "").trim().toLowerCase() !== "active") throw new HttpError(403, "Tessera non attiva");
  const year = Number(profile.membership_year) || new Date().getUTCFullYear();
  const expirationDate = new Date(Date.UTC(year, 11, 31, 22, 59, 59));
  if (expirationDate.getTime() < Date.now()) throw new HttpError(403, "Tessera scaduta");
  return { id, year, expirationDate, expiryLabel: `31/12/${year}` };
}

function displayName(profile) {
  return [profile.first_name, profile.last_name].filter((value) => String(value ?? "").trim().length > 0).join(" ").trim();
}

function formatItalianDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

async function loadCertificates(config) {
  const parsed = parseP12(config.certificateP12Base64, config.certificatePassword, config.passTypeIdentifier);
  return {
    signerCert: parsed.signerCert,
    signerKey: parsed.signerKey,
    signerKeyPassphrase: config.certificatePassword,
    wwdr: parsed.wwdr || await fetchWWDR(parsed.issuerCommonName),
  };
}

function parseP12(base64, password, passTypeIdentifier) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(base64.replace(/\s/g, ""))), false, password);
  const certs = [];
  const keys = [];
  for (const safeContent of p12.safeContents ?? []) {
    for (const safeBag of safeContent.safeBags ?? []) {
      if (safeBag.cert) certs.push(safeBag.cert);
      if (safeBag.key) keys.push(safeBag.key);
    }
  }
  const passCert = certs.find((cert) => certificateMatchesPassType(cert, passTypeIdentifier)) || certs.find((cert) => !subjectCommonName(cert).includes("Worldwide Developer Relations"));
  const wwdrCert = certs.find((cert) => subjectCommonName(cert).includes("Worldwide Developer Relations"));
  const privateKey = keys[0];
  if (!passCert || !privateKey) throw new HttpError(500, "Certificato Wallet non valido");
  return {
    signerCert: forge.pki.certificateToPem(passCert),
    signerKey: forge.pki.encryptRsaPrivateKey(privateKey, password, { algorithm: "aes256" }),
    wwdr: wwdrCert ? forge.pki.certificateToPem(wwdrCert) : null,
    issuerCommonName: issuerCommonName(passCert),
  };
}

function certificateMatchesPassType(cert, passTypeIdentifier) {
  const cn = subjectCommonName(cert);
  const ou = String(cert.subject.getField("OU")?.value ?? "");
  return cn.includes(passTypeIdentifier) || ou.includes(passTypeIdentifier);
}
function subjectCommonName(cert) { return String(cert.subject.getField("CN")?.value ?? ""); }
function issuerCommonName(cert) { return String(cert.issuer.getField("CN")?.value ?? ""); }

async function fetchWWDR(issuerCN) {
  const order = [];
  const normalized = String(issuerCN ?? "").toUpperCase();
  if (normalized.includes("G6")) order.push("G6");
  if (normalized.includes("G4")) order.push("G4");
  order.push("G6", "G4", "G3");
  for (const generation of [...new Set(order)]) {
    try {
      const response = await fetch(`https://www.apple.com/certificateauthority/AppleWWDRCA${generation}.cer`);
      if (response.ok) return derCertificateToPem(await response.arrayBuffer());
    } catch (error) {
      console.error("WWDR fetch failed", generation, error);
    }
  }
  throw new HttpError(500, "Certificato intermedio Apple WWDR non disponibile");
}

function derCertificateToPem(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return forge.pki.certificateToPem(forge.pki.certificateFromAsn1(forge.asn1.fromDer(binary)));
}

async function loadLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const response = await fetch(logoURL, { headers: { Accept: "image/png" } });
    if (!response.ok) throw new Error(`Logo fetch failed ${response.status}`);
    cachedLogoBuffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error("Wallet logo fetch failed; using fallback", error);
    cachedLogoBuffer = makeLogoPNG(120);
  }
  return cachedLogoBuffer;
}

async function loadLogoPNG() {
  if (cachedLogoPNG) return cachedLogoPNG;
  try {
    cachedLogoPNG = PNG.sync.read(await loadLogoBuffer());
  } catch (_) {
    cachedLogoPNG = PNG.sync.read(makeLogoPNG(120));
  }
  return cachedLogoPNG;
}

function makeStripPNG(logo, width, height) {
  const png = new PNG({ width, height, colorType: 6 });
  fill(png, primary, 255);
  drawCircle(png, width * 0.05, height * 0.18, height * 0.68, [30, 76, 51], 220);
  drawCircle(png, width * 0.88, height * 0.12, height * 0.85, [28, 70, 47], 175);
  drawTriangle(png, width * 0.62, -height * 0.12, width * 1.08, 0, width * 1.08, height * 1.05, primaryDeep, 90);
  drawTriangle(png, width * 0.80, -height * 0.10, width * 1.08, height * 0.18, width * 0.98, height * 1.05, primaryDark, 90);
  drawImageScaled(logo, png, Math.floor(width * 0.76), Math.floor(height * 0.12), Math.floor(height * 0.68), Math.floor(height * 0.68), 0.22);
  drawRect(png, 0, Math.floor(height * 0.85), width, Math.max(1, Math.floor(height * 0.045)), gold, 185);
  return PNG.sync.write(png);
}

function drawBrandMark(png, x, y, size) {
  drawTriangle(png, x + size * 0.44, y + size * 0.07, x + size * 0.12, y + size * 0.82, x + size * 0.42, y + size * 0.82, cream, 255);
  drawTriangle(png, x + size * 0.54, y + size * 0.07, x + size * 0.46, y + size * 0.82, x + size * 0.82, y + size * 0.82, cream, 255);
  drawCircle(png, x + size * 0.77, y + size * 0.13, size * 0.11, gold, 255);
}

function makeIconPNG(size) {
  const png = new PNG({ width: size, height: size, colorType: 6 });
  fill(png, primary, 255);
  drawBrandMark(png, size * 0.10, size * 0.10, size * 0.82);
  return PNG.sync.write(png);
}

function makeLogoPNG(size) {
  const png = new PNG({ width: size, height: size, colorType: 6 });
  fill(png, [0, 0, 0], 0);
  drawCircle(png, size / 2, size / 2, size * 0.48, primary, 255);
  drawBrandMark(png, size * 0.18, size * 0.18, size * 0.64);
  return PNG.sync.write(png);
}

function drawImageScaled(source, target, x, y, width, height, opacity) {
  for (let ty = 0; ty < height; ty++) for (let tx = 0; tx < width; tx++) {
    const sx = Math.min(source.width - 1, Math.floor(tx / width * source.width));
    const sy = Math.min(source.height - 1, Math.floor(ty / height * source.height));
    const si = (source.width * sy + sx) << 2;
    const alpha = source.data[si + 3] / 255 * opacity;
    if (alpha > 0) blendPixel(target, x + tx, y + ty, [source.data[si], source.data[si + 1], source.data[si + 2]], alpha);
  }
}

function fill(png, rgb, alpha) { for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) setPixel(png, x, y, rgb, alpha); }
function drawRect(png, x, y, width, height, rgb, alpha) { for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) setPixel(png, xx, yy, rgb, alpha); }
function drawCircle(png, cx, cy, radius, rgb, alpha) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
    const dx = x + 0.5 - cx; const dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r2) setPixel(png, x, y, rgb, alpha);
  }
}
function drawTriangle(png, ax, ay, bx, by, cx, cy, rgb, alpha) {
  const minX = Math.floor(Math.min(ax, bx, cx)); const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy)); const maxY = Math.ceil(Math.max(ay, by, cy));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (pointInTriangle(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy)) setPixel(png, x, y, rgb, alpha);
}
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const area = 0.5 * (-by * cx + ay * (-bx + cx) + ax * (by - cy) + bx * cy);
  const s = 1 / (2 * area) * (ay * cx - ax * cy + (cy - ay) * px + (ax - cx) * py);
  const t = 1 / (2 * area) * (ax * by - ay * bx + (ay - by) * px + (bx - ax) * py);
  return s >= 0 && t >= 0 && (s + t) <= 1;
}
function setPixel(png, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (png.width * y + x) << 2;
  png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = alpha;
}
function blendPixel(png, x, y, rgb, sourceAlpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (png.width * y + x) << 2; const targetAlpha = png.data[i + 3] / 255; const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) { png.data[i + 3] = 0; return; }
  png.data[i] = Math.round((rgb[0] * sourceAlpha + png.data[i] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  png.data[i + 1] = Math.round((rgb[1] * sourceAlpha + png.data[i + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  png.data[i + 2] = Math.round((rgb[2] * sourceAlpha + png.data[i + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  png.data[i + 3] = Math.round(outAlpha * 255);
}
function requireEnv(name) { const value = Deno.env.get(name); if (!value) throw new HttpError(500, `Secret mancante: ${name}`); return value; }
function jsonError(status, message) { return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
