import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

function expandEnv(value, depth = 5) {
  if (typeof value !== "string" || !value.includes("${")) return value;
  let resolved = value;
  const pattern = /\$\{([^}]+)\}/g;
  for (let i = 0; i < depth && typeof resolved === "string" && resolved.includes("${"); i++) {
    resolved = resolved.replace(pattern, (_, varName) => process.env[varName] ?? "");
  }
  return resolved;
}

function buildPayload() {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "production";
  const apiBaseRaw = expandEnv(process.env.PUBLIC_API_BASE_URL || "") || "";
  const apiBase = apiBaseRaw.replace(/\/+$/, "");
  const supabaseUrl =
    expandEnv(process.env.PUBLIC_SUPABASE_URL) ||
    expandEnv(process.env.SUPABASE_URL) ||
    "";
  const supabaseAnonKey =
    expandEnv(process.env.PUBLIC_SUPABASE_ANON_KEY) ||
    expandEnv(process.env.SUPABASE_ANON_KEY) ||
    "";

  const payload = {
    APP_ENV: appEnv,
    API_BASE_URL: apiBase,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      typeof value === "number" ? true : Boolean(value)
    )
  );
}

function writeEnvFile(payload) {
  const targetPath = path.join(rootDir, "public", "env.js");
  const content = `window.__ENV__ = Object.assign({}, window.__ENV__ || {}, ${JSON.stringify(
    payload
  )});\n`;
  fs.writeFileSync(targetPath, content, "utf8");
  console.log(`[env] Generated ${targetPath}`);
}

const payload = buildPayload();
writeEnvFile(payload);
