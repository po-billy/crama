

// server.js
import express from "express";
import fs from "fs";
import https from "https";
import net from "net";
import crypto from "crypto";
import fetch, { FormData } from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";
import sharp from "sharp";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || "local";
const envFileOrder = [
  ".env",
  APP_ENV ? `.env.${APP_ENV}` : null,
  APP_ENV === "local" ? ".env.local" : null,
  APP_ENV && APP_ENV !== "local" ? `.env.${APP_ENV}.local` : null,
].filter((value, index, self) => value && self.indexOf(value) === index);
const loadedEnvFiles = [];
for (const fileName of envFileOrder) {
  if (!fileName) continue;
  const envPath = path.join(__dirname, fileName);
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: true });
  loadedEnvFiles.push(fileName);
}
if (!loadedEnvFiles.length) {
  const fallback = path.join(__dirname, ".env");
  if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback, override: true });
    loadedEnvFiles.push(".env");
  }
}
console.log(`[env] mode=${APP_ENV} loaded files: ${loadedEnvFiles.join(", ") || "none"}`);

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();

function parsePort(value, fallback = 3000) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || num > 65535) return fallback;
  return num;
}
function parseAddressList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
const DEFAULT_PORT = parsePort(process.env.PORT, 3000);
const PORT_FALLBACK_ATTEMPTS = Math.max(
  0,
  Number.parseInt(process.env.PORT_FALLBACK_ATTEMPTS ?? "", 10) || 10
);

function expandEnvValue(value, maxDepth = 5) {
  if (typeof value !== "string" || !value.includes("${")) return value;
  let resolved = value;
  const pattern = /\$\{([^}]+)\}/g;
  for (let depth = 0; depth < maxDepth && typeof resolved === "string" && resolved.includes("${"); depth++) {
    resolved = resolved.replace(pattern, (match, varName) => process.env[varName] ?? "");
  }
  return resolved;
}

// ==== ENV ====
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = expandEnvValue(process.env.SUPABASE_URL);
const SUPABASE_ANON_KEY = expandEnvValue(process.env.SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = expandEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_BASE_URL = expandEnvValue(process.env.PUBLIC_API_BASE_URL) || "";
const PUBLIC_SUPABASE_URL = expandEnvValue(process.env.PUBLIC_SUPABASE_URL) || SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY =
  expandEnvValue(process.env.PUBLIC_SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;
const CONTACT_MAIL_FROM = expandEnvValue(process.env.CONTACT_MAIL_FROM) || "help@crama.app";
const CONTACT_MAIL_TO = expandEnvValue(process.env.CONTACT_MAIL_TO) || CONTACT_MAIL_FROM;
const CONTACT_MAIL_BCC = parseAddressList(expandEnvValue(process.env.CONTACT_MAIL_BCC || ""));
const CONTACT_MAIL_SUBJECT_PREFIX =
  process.env.CONTACT_MAIL_SUBJECT_PREFIX || "[Crama 문의]";
const CONTACT_SMTP_HOST = process.env.CONTACT_SMTP_HOST || "";
const CONTACT_SMTP_PORT = safeInt(process.env.CONTACT_SMTP_PORT, 587, { min: 1 });
const CONTACT_SMTP_SECURE =
  String(process.env.CONTACT_SMTP_SECURE ?? (CONTACT_SMTP_PORT === 465 ? "true" : "false"))
    .toLowerCase()
    .trim() === "true";
const CONTACT_SMTP_USER = process.env.CONTACT_SMTP_USER || "";
const CONTACT_SMTP_PASS = process.env.CONTACT_SMTP_PASS || "";
const CONTACT_GMAIL_USER = process.env.CONTACT_GMAIL_USER || "";
const CONTACT_GMAIL_PASS = process.env.CONTACT_GMAIL_PASS || "";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const OPENAI_ANALYZE_MODEL = process.env.OPENAI_ANALYZE_MODEL || "gpt-4o-mini";
const OPENAI_PROMPT_COST_PER_1K_WON = parseFloat(process.env.OPENAI_PROMPT_COST_PER_1K_WON) || 0.2215;
const OPENAI_COMPLETION_COST_PER_1K_WON = parseFloat(process.env.OPENAI_COMPLETION_COST_PER_1K_WON) || 0.8858;
const TOKEN_COST_MARGIN = parseFloat(process.env.TOKEN_COST_MARGIN) || 1.6;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || null;
const FASHION_CREDIT_COST = parseInt(process.env.FASHION_CREDIT_COST, 10) || 20;
const STUDIO_CREDIT_COST = parseInt(process.env.STUDIO_CREDIT_COST, 10) || 100;
const SCENE_IMAGE_CREDIT_COST = parseInt(process.env.SCENE_IMAGE_CREDIT_COST, 10) || 5;
const AVATAR_BUCKET = process.env.AVATAR_BUCKET || "character_profile";
const STUDIO_BUCKET = process.env.STUDIO_GENERATE_BUCKET || "generate_image_character";
// Studio service code must not be null (user_contents has NOT NULL FK)
const SERVICE_CODE_STUDIO = process.env.SERVICE_CODE_STUDIO || "CRAMA_STUDIO";
const HANDLE_CHANGE_COOLDOWN_DAYS = parseInt(process.env.HANDLE_CHANGE_COOLDOWN_DAYS, 10) || 30;
// Optional category (enum differs per project) — omit if not provided
function optionalCategory(value) {
  if (!value) return null;
  return String(value).trim();
}
const CREDIT_CATEGORY_CHAT = optionalCategory(process.env.CREDIT_CATEGORY_CHAT);
const CREDIT_CATEGORY_FASHION = optionalCategory(process.env.CREDIT_CATEGORY_FASHION);
const CREDIT_CATEGORY_STUDIO = optionalCategory(process.env.CREDIT_CATEGORY_STUDIO);
const CREDIT_CATEGORY_DAILY_WELCOME =
  optionalCategory(process.env.CREDIT_CATEGORY_DAILY_WELCOME);
// Valid tx_type enum: charge, usage, reset, adjustment
function safeTxType(value, fallback = "usage") {
  const allowed = ["charge", "usage", "reset", "adjustment"];
  if (!value) return fallback;
  const str = String(value).trim().toLowerCase();
  if (allowed.includes(str)) return str;
  return fallback;
}
const CREDIT_TX_TYPE_SPEND = safeTxType(process.env.CREDIT_TX_TYPE_SPEND);

function safeInt(value, fallback, { min } = {}) {
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  if (typeof min === "number" && num < min) return fallback;
  return num;
}

const DAILY_WELCOME_ENABLED = String(process.env.DAILY_WELCOME_ENABLED ?? "true")
  .toLowerCase()
  .trim() !== "false";
const DAILY_WELCOME_CREDIT_AMOUNT = safeInt(process.env.DAILY_WELCOME_CREDIT_AMOUNT, 300, {
  min: 0,
});
const DAILY_WELCOME_MAX_PER_DAY = safeInt(process.env.DAILY_WELCOME_MAX_PER_DAY, 1, {
  min: 1,
});

const STABILITY_ALLOWED_DIMENSIONS = [
  { width: 1024, height: 1024 },
  { width: 1152, height: 896 },
  { width: 1216, height: 832 },
  { width: 1344, height: 768 },
  { width: 1536, height: 640 },
  { width: 640, height: 1536 },
  { width: 768, height: 1344 },
  { width: 832, height: 1216 },
  { width: 896, height: 1152 },
];

const CHAT_MODE_CONFIG_PATH = path.join(__dirname, 'public', 'data', 'chat-modes.json');
let chatModeConfig = { tokenIncrement: 100, modes: [] };
try {
  if (fs.existsSync(CHAT_MODE_CONFIG_PATH)) {
    const raw = fs.readFileSync(CHAT_MODE_CONFIG_PATH, 'utf-8');
    chatModeConfig = JSON.parse(raw);
  } else {
    console.warn('[chat-mode] config file not found at', CHAT_MODE_CONFIG_PATH);
  }
} catch (e) {
  console.warn('[chat-mode] failed to load config, fallback will be used', e);
  chatModeConfig = { tokenIncrement: 100, modes: [] };
}

const FALLBACK_CHAT_MODE = {
  key: 'default',
  name: '기본 대화 모드',
  baseTokens: 512,
  baseCredits: 10,
  extraCreditPerIncrement: 5,
  tokenIncrement: 100,
  multipliers: [1, 1.5, 2, 3],
  defaultMultiplier: 1
};

function getChatModeList() {
  return Array.isArray(chatModeConfig?.modes) ? chatModeConfig.modes : [];
}

function getChatModeConfigByKey(key) {
  if (!key) return null;
  return getChatModeList().find((mode) => mode.key === key) || null;
}

function getDefaultChatModeConfig() {
  const list = getChatModeList();
  if (!list.length) return FALLBACK_CHAT_MODE;
  if (chatModeConfig?.defaultMode) {
    const match = list.find((mode) => mode.key === chatModeConfig.defaultMode);
    if (match) return match;
  }
  return list[0];
}

function resolveModeMultiplier(mode, multiplier) {
  const multipliers =
    (Array.isArray(mode?.multipliers) && mode.multipliers.length ? mode.multipliers : [1]).map((value) =>
      Number(value)
    );
  const defaultMultiplier = Number(mode?.defaultMultiplier) || multipliers[0] || 1;
  const numeric = Number(multiplier);
  if (!Number.isNaN(numeric)) {
    const matched = multipliers.find((value) => Math.abs(value - numeric) < 0.0001);
    if (typeof matched === 'number') {
      return matched;
    }
  }
  return defaultMultiplier;
}

function computeChatModeUsage(modeInput, multiplier) {
  const mode = modeInput || getDefaultChatModeConfig();
  const baseTokens = Number(mode?.baseTokens) || FALLBACK_CHAT_MODE.baseTokens;
  const baseCredits = Number(mode?.baseCredits) || FALLBACK_CHAT_MODE.baseCredits;
  const incrementSize =
    Number(mode?.tokenIncrement || chatModeConfig?.tokenIncrement || FALLBACK_CHAT_MODE.tokenIncrement) ||
    100;
  const extraCreditPerIncrement =
    Number(
      mode?.extraCreditPerIncrement ??
        mode?.perIncrementCredits ??
        mode?.per100Tokens ??
        FALLBACK_CHAT_MODE.extraCreditPerIncrement
    ) || 0;
  const selectedMultiplier = resolveModeMultiplier(mode, multiplier);
  const calculatedTokens = Math.round(baseTokens * selectedMultiplier);
  const maxTokens = Math.max(baseTokens, calculatedTokens);
  const additionalTokens = Math.max(0, maxTokens - baseTokens);
  const increments = incrementSize > 0 ? Math.ceil(additionalTokens / incrementSize) : 0;
  const creditCost = baseCredits + increments * extraCreditPerIncrement;
  return {
    mode,
    maxTokens,
    creditCost,
    multiplier: selectedMultiplier
  };
}

function computeTokenCreditCost(inputTokens, outputTokens, fallbackCost = 1) {
  if (!Number.isFinite(inputTokens) || inputTokens < 0) inputTokens = 0;
  if (!Number.isFinite(outputTokens) || outputTokens < 0) outputTokens = 0;
  const promptCostWon = (inputTokens / 1000) * OPENAI_PROMPT_COST_PER_1K_WON;
  const completionCostWon = (outputTokens / 1000) * OPENAI_COMPLETION_COST_PER_1K_WON;
  const rawWon = (promptCostWon + completionCostWon) * TOKEN_COST_MARGIN;
  if (!rawWon || rawWon <= 0) {
    return Math.max(1, Math.ceil(fallbackCost));
  }
  return Math.max(1, Math.ceil(rawWon));
}

function randomHandleCandidate() {
  const adjectives = [
    "bold",
    "calm",
    "brisk",
    "clever",
    "merry",
    "silent",
    "lucky",
    "swift",
    "bright",
    "kind",
  ];
  const nouns = [
    "otter",
    "fox",
    "lynx",
    "panda",
    "tiger",
    "crane",
    "whale",
    "sparrow",
    "wolf",
    "owl",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900); // 3 digits
  return `${adj}-${noun}-${num}`;
}

async function generateUniqueHandle(adminClient) {
  for (let i = 0; i < 12; i++) {
    const candidate = randomHandleCandidate();
      const { data, error } = await adminClient
        .from("profiles")
        .select("id")
        .eq("handle", candidate)
        .maybeSingle();
    if (error) {
      console.warn("handle uniqueness check error", error);
      break;
    }
    if (!data) return candidate;
  }
  return null;
}

async function getUserMetadata(adminClient, userId) {
  try {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error) return {};
    return data?.user?.user_metadata || {};
  } catch {
    return {};
  }
}

async function updateUserMetadata(adminClient, userId, meta) {
  try {
    await adminClient.auth.admin.updateUserById(userId, { user_metadata: meta });
  } catch (e) {
    console.warn("updateUserMetadata failed", e);
  }
}

// ==== ?대씪?댁뼵???앹꽦 ====
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Admin client (bypasses RLS for internal credit operations)
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

let contactMailer = null;
if (CONTACT_GMAIL_USER && CONTACT_GMAIL_PASS) {
  contactMailer = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: CONTACT_GMAIL_USER,
      pass: CONTACT_GMAIL_PASS,
    },
  });
  console.log("[contact] Gmail transport active");
} else if (CONTACT_SMTP_HOST && CONTACT_SMTP_USER && CONTACT_SMTP_PASS) {
  contactMailer = nodemailer.createTransport({
    host: CONTACT_SMTP_HOST,
    port: CONTACT_SMTP_PORT,
    secure: CONTACT_SMTP_SECURE,
    auth: {
      user: CONTACT_SMTP_USER,
      pass: CONTACT_SMTP_PASS,
    },
  });
  console.log("[contact] Custom SMTP transport active");
} else {
  console.warn(
    "[contact] 문의 이메일 전송이 비활성화되어 있습니다. CONTACT_GMAIL_* 또는 CONTACT_SMTP_* env를 설정해주세요."
  );
}

function resolvePublicRuntimeConfig() {
  const supabaseUrl =
    expandEnvValue(process.env.PUBLIC_SUPABASE_URL) ||
    PUBLIC_SUPABASE_URL ||
    SUPABASE_URL;
  const supabaseAnonKey =
    expandEnvValue(process.env.PUBLIC_SUPABASE_ANON_KEY) ||
    PUBLIC_SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY;
  const apiBaseUrl =
    expandEnvValue(process.env.PUBLIC_API_BASE_URL) ||
    PUBLIC_API_BASE_URL ||
    "";
  return { supabaseUrl, supabaseAnonKey, apiBaseUrl };
}

function buildPublicRuntimeConfig() {
  const { supabaseUrl, supabaseAnonKey, apiBaseUrl } = resolvePublicRuntimeConfig();
  const payload = {
    APP_ENV,
    API_BASE_URL: apiBaseUrl,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      typeof value === "number" ? true : Boolean(value)
    )
  );
}

// Increase body size limit to handle data URLs for analysis
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

function requireAdmin(res) {
  if (!supabaseAdmin) {
    sendError(res, 500, "admin_client_missing", { message: "Service role key is required" });
    return null;
  }
  return supabaseAdmin;
}

// Serve static assets from Netlify-style public directory
const STATIC_DIR = path.join(__dirname, "public");

app.get("/env.js", (req, res) => {
  const config = buildPublicRuntimeConfig();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("application/javascript");
  res.send(
    `window.__ENV__ = Object.assign({}, window.__ENV__ || {}, ${JSON.stringify(config)});`
  );
});

app.use(express.static(STATIC_DIR));

// Support extensionless HTML routes locally (matching Netlify rewrites)
const HTML_ROUTE_MAP = {
  "/": "index.html",
  "/studio": "studio.html",
  "/studio2non": "studio2non.html",
  "/characters": "characters.html",
  "/character": "character.html",
  "/create-character": "create-character.html",
  "/creator": "creator.html",
  "/menu": "menu.html",
  "/mypage": "mypage.html",
  "/works": "works.html",
  "/contact": "contact.html",
  "/login": "login.html",
  "/coming-soon": "coming-soon.html",
};

for (const [route, file] of Object.entries(HTML_ROUTE_MAP)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, file));
  });
}

const CONTACT_CATEGORY_LABELS = {
  general: "일반 문의",
  billing: "결제/scene",
  bug: "버그 신고",
  partnership: "제휴/협업",
  other: "기타",
};
const CONTACT_MAX_MESSAGE_LENGTH = 2000;

function sanitizeLine(value, max = 120) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}
function sanitizeMultiline(value, max = CONTACT_MAX_MESSAGE_LENGTH) {
  if (!value) return "";
  return String(value).trim().slice(0, max);
}
function isValidEmail(value) {
  if (!value) return false;
  return /^[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
    value
  );
}
function resolveContactCategory(raw) {
  const key = String(raw || "general").toLowerCase();
  if (CONTACT_CATEGORY_LABELS[key]) return key;
  return "general";
}

app.post("/api/contact", async (req, res) => {
  if (!contactMailer) {
    return sendError(res, 503, "contact_disabled", {
      message: "문의하기 이메일 전송이 아직 설정되지 않았습니다.",
    });
  }
  const body = req.body || {};
  const name = sanitizeLine(body.name, 80);
  const email = sanitizeLine(body.email, 120);
  const categoryKey = resolveContactCategory(body.category);
  const categoryLabel = CONTACT_CATEGORY_LABELS[categoryKey];
  const message = sanitizeMultiline(body.message, CONTACT_MAX_MESSAGE_LENGTH);
  const page = sanitizeLine(body.page || body.pageUrl || req.headers.referer, 200);

  if (!name || !email || !message) {
    return sendError(res, 400, "missing_fields");
  }
  if (!isValidEmail(email)) {
    return sendError(res, 400, "invalid_email");
  }

  const replyTo = email;
  const clientIp = (req.headers["x-forwarded-for"] || req.ip || "").toString();
  const userAgent = sanitizeLine(req.headers["user-agent"], 200);
  const submittedAt = new Date().toISOString();

  const textBody = [
    `문의 유형: ${categoryLabel}`,
    `이름: ${name}`,
    `이메일: ${email}`,
    page ? `페이지: ${page}` : null,
    `제출 시간: ${submittedAt}`,
    clientIp ? `IP: ${clientIp}` : null,
    userAgent ? `User-Agent: ${userAgent}` : null,
    "",
    "------ 내용 ------",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlBody = `
    <p><strong>문의 유형:</strong> ${categoryLabel}</p>
    <p><strong>이름:</strong> ${name}<br/>
    <strong>이메일:</strong> ${email}<br/>
    ${page ? `<strong>페이지:</strong> ${page}<br/>` : ""} 
    <strong>제출 시간:</strong> ${submittedAt}<br/>
    ${clientIp ? `<strong>IP:</strong> ${clientIp}<br/>` : ""} 
    ${userAgent ? `<strong>User-Agent:</strong> ${userAgent}` : ""}</p>
    <hr/>
    <p style="white-space:pre-wrap">${message}</p>
  `;

  const toList = parseAddressList(CONTACT_MAIL_TO);
  if (!toList.length) {
    return sendError(res, 500, "contact_recipient_missing");
  }

  try {
    await contactMailer.sendMail({
      from: CONTACT_MAIL_FROM,
      to: toList,
      bcc: CONTACT_MAIL_BCC.length ? CONTACT_MAIL_BCC : undefined,
      replyTo,
      subject: `${CONTACT_MAIL_SUBJECT_PREFIX} ${categoryLabel} - ${name}`,
      text: textBody,
      html: htmlBody,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("contact email failed", error);
    return sendError(res, 502, "contact_send_failed");
  }
});

/**
 * 怨듭슜: ?먮윭 ?묐떟 ?ы띁
 */
function sendError(res, status, message, extra = {}) {
  console.error("ERROR", message, extra);
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

// ===============================
// Creator feed local store (file-based)
// ===============================
const CREATOR_FEED_DIR = path.join(__dirname, "data");
const CREATOR_FEED_STORE_PATH = path.join(CREATOR_FEED_DIR, "creator-feed.json");
const CREATOR_FEED_PAGE_SIZE = 10;
const CREATOR_FEED_MAX_CONTENT_LENGTH = 2000;

function loadCreatorFeedStore() {
  try {
    if (!fs.existsSync(CREATOR_FEED_STORE_PATH)) {
      return { posts: [], comments: [] };
    }
    const raw = fs.readFileSync(CREATOR_FEED_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      posts: Array.isArray(parsed?.posts) ? parsed.posts : [],
      comments: Array.isArray(parsed?.comments) ? parsed.comments : [],
    };
  } catch (error) {
    console.warn("[creator-feed] failed to load store", error);
    return { posts: [], comments: [] };
  }
}

function persistCreatorFeedStore(store) {
  try {
    if (!fs.existsSync(CREATOR_FEED_DIR)) {
      fs.mkdirSync(CREATOR_FEED_DIR, { recursive: true });
    }
    fs.writeFileSync(
      CREATOR_FEED_STORE_PATH,
      JSON.stringify(store, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("[creator-feed] persist failed", error);
  }
}

const creatorFeedStore = loadCreatorFeedStore();

function sanitizeFeedContent(value) {
  return String(value || "")
    .trim()
    .slice(0, CREATOR_FEED_MAX_CONTENT_LENGTH);
}

function sanitizeFeedImageUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.href;
  } catch (error) {
    return null;
  }
}

function encodeFeedCursor(payload) {
  const base = Buffer.from(JSON.stringify(payload)).toString("base64");
  return base.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeFeedCursor(cursor) {
  if (!cursor) return null;
  try {
    const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLength);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("[creator-feed] invalid cursor", error);
    return null;
  }
}

function buildAuthorSnapshot(user) {
  if (!user) return null;
  const fallbackName = user.email ? user.email.split("@")[0] : "크리에이터";
  return {
    id: user.id,
    name:
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      fallbackName ||
      "크리에이터",
    handle: user.user_metadata?.user_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
  };
}

function mapPostToResponse(post, viewerId) {
  const likeUserIds = Array.isArray(post.like_user_ids) ? post.like_user_ids : [];
  const commentCount = creatorFeedStore.comments.filter(
    (comment) => comment.post_id === post.id
  ).length;
  return {
    id: post.id,
    owner_id: post.owner_id,
    author_name: post.author_snapshot?.name || "작가",
    author_handle: post.author_snapshot?.handle || null,
    created_at: post.created_at,
    updated_at: post.updated_at,
    content: post.content,
    type: post.type || "characters",
    image_url: post.image_url || null,
    like_count: likeUserIds.length,
    liked: viewerId ? likeUserIds.includes(viewerId) : false,
    comment_count: commentCount,
    is_owner: viewerId ? viewerId === post.owner_id : false,
  };
}

function findPostById(postId) {
  return creatorFeedStore.posts.find((post) => post.id === postId) || null;
}

function findCommentById(commentId) {
  return creatorFeedStore.comments.find((comment) => comment.id === commentId) || null;
}

function removePostComments(postId) {
  const remaining = creatorFeedStore.comments.filter(
    (comment) => comment.post_id !== postId
  );
  creatorFeedStore.comments = remaining;
}

function removeCommentWithChildren(commentId) {
  const queue = [commentId];
  const toDelete = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || toDelete.has(current)) continue;
    toDelete.add(current);
    creatorFeedStore.comments.forEach((comment) => {
      if (comment.parent_id === current) queue.push(comment.id);
    });
  }
  creatorFeedStore.comments = creatorFeedStore.comments.filter(
    (comment) => !toDelete.has(comment.id)
  );
}

function buildCommentTree(postId, viewerId) {
  const related = creatorFeedStore.comments
    .filter((comment) => comment.post_id === postId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const map = new Map();
  related.forEach((comment) => {
    const likeUserIds = Array.isArray(comment.like_user_ids) ? comment.like_user_ids : [];
    map.set(comment.id, {
      id: comment.id,
      post_id: comment.post_id,
      root_post_id: comment.post_id,
      parent_id: comment.parent_id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      author_name: comment.author_snapshot?.name || "사용자",
      author_handle: comment.author_snapshot?.handle || null,
      like_count: likeUserIds.length,
      liked: viewerId ? likeUserIds.includes(viewerId) : false,
      is_owner: viewerId ? viewerId === comment.user_id : false,
      replies: [],
    });
  });
  const roots = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function getDailyResetTimes() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, next };
}

function clampSizeToOpenAI(size) {
  // gpt-image-1 supports 1024/512/256 square; pick the nearest lower size to reduce egress.
  const maxSide = Math.max(size?.width || 1024, size?.height || 1024);
  if (maxSide <= 256) return "256x256";
  if (maxSide <= 512) return "512x512";
  return "1024x1024";
}

function makeBBoxPrompt(bbox) {
  if (!bbox) return "";
  const { x = 0, y = 0, w = 1, h = 1 } = bbox;
  return `Place the garment inside the normalized bbox: x=${x.toFixed(
    3
  )}, y=${y.toFixed(3)}, w=${w.toFixed(3)}, h=${h.toFixed(
    3
  )} of the full canvas. Keep everything outside fully transparent.`;
}

function dataUrlToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL");
  }
  return {
    buffer: Buffer.from(matches[2], "base64"),
    contentType: matches[1],
  };
}

async function bufferToWebp(buffer, quality = 85) {
  const safeQuality = Math.max(1, Math.min(quality, 100));
  return sharp(buffer).webp({ quality: safeQuality, effort: 4 }).toBuffer();
}

function pickStabilityDimension(width, height) {
  if (!width || !height) return STABILITY_ALLOWED_DIMENSIONS[0];
  const ratio = width / height;
  let best = STABILITY_ALLOWED_DIMENSIONS[0];
  let bestDiff = Infinity;
  for (const dim of STABILITY_ALLOWED_DIMENSIONS) {
    const dimRatio = dim.width / dim.height;
    const diff = Math.abs(dimRatio - ratio);
    if (diff < bestDiff) {
      best = dim;
      bestDiff = diff;
    }
  }
  return best;
}

async function prepareImageForStability(dataUrl, options = {}) {
  const { enforcedDims = null, preferPng = false } = options;
  const bufferInfo = dataUrlToBuffer(dataUrl);
  let mime = bufferInfo.contentType || "image/png";
  if (preferPng) {
    mime = "image/png";
  }
  const image = await Jimp.read(bufferInfo.buffer);
  const currentDims = { width: image.bitmap.width, height: image.bitmap.height };
  const targetDims = enforcedDims || pickStabilityDimension(currentDims.width, currentDims.height);
  if (currentDims.width !== targetDims.width || currentDims.height !== targetDims.height) {
    image.cover(targetDims.width, targetDims.height);
  }
  let jimpMime = Jimp.MIME_PNG;
  if (mime === "image/jpeg" || mime === "image/jpg") {
    jimpMime = Jimp.MIME_JPEG;
  } else if (mime === "image/webp") {
    jimpMime = Jimp.MIME_WEBP;
  }
  const processedBuffer = await image.getBuffer(jimpMime);
  return {
    buffer: processedBuffer,
    contentType: jimpMime,
    dimensions: targetDims,
  };
}

function slugifyKey(value, fallback = '') {
  const raw = (value || '').toString().trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function parseExampleDialogPairs(examplePairs, fallbackText) {
  if (Array.isArray(examplePairs) && examplePairs.length) {
    return examplePairs
      .map((pair) => ({
        user: (pair?.user || '').trim(),
        character: (pair?.character || '').trim(),
      }))
      .filter((pair) => pair.user || pair.character);
  }
  if (typeof fallbackText === 'string' && fallbackText.trim()) {
    const blocks = fallbackText.split(/\n{2,}/g);
    const parsed = [];
    blocks.forEach((block) => {
      const userMatch = block.match(/사용자:\s*(.+)/);
      const characterMatch = block.match(/캐릭터:\s*(.+)/);
      if (userMatch || characterMatch) {
        parsed.push({
          user: (userMatch?.[1] || '').trim(),
          character: (characterMatch?.[1] || '').trim(),
        });
      }
    });
    return parsed.filter((pair) => pair.user || pair.character);
  }
  return [];
}

function buildExampleMessages(pairs = []) {
  const messages = [];
  pairs.forEach((pair) => {
    if (pair.user) {
      messages.push({ role: 'user', content: pair.user });
    }
    if (pair.character) {
      messages.push({ role: 'assistant', content: pair.character });
    }
  });
  return messages;
}

function sanitizeSceneTemplates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const keywords = Array.isArray(item?.keywords)
        ? item.keywords
        : typeof item?.keywords === 'string'
          ? item.keywords.split(',').map((word) => word.trim()).filter(Boolean)
          : [];
      return {
        image_url: item?.image_url || item?.url || null,
        label: item?.label || '',
        description: item?.description || '',
        keywords,
        emotion_key: item?.emotion_key || item?.emotionKey || '',
      };
    })
    .filter((item) => item.image_url);
}

function extractSceneRequest(text) {
  if (!text) return { cleaned: text, sceneKey: null };
  let sceneKey = null;
  const cleaned = text.replace(/\[\[SCENE:([^\]]+)\]\]/i, (_, key) => {
    sceneKey = key.trim();
    return '';
  }).trim();
  return { cleaned, sceneKey };
}

function matchSceneTemplate(templates, rawKey) {
  if (!rawKey) return null;
  const normalized = slugifyKey(rawKey);
  let matched =
    templates.find((tpl) => slugifyKey(tpl.emotion_key, null) === normalized) ||
    templates.find((tpl) => slugifyKey(tpl.label) === normalized);
  if (matched) return matched;
  const lowerKey = rawKey.toLowerCase();
  matched = templates.find((tpl) => {
    if (tpl.label?.toLowerCase().includes(lowerKey)) return true;
    return tpl.keywords?.some((kw) => kw.toLowerCase().includes(lowerKey));
  });
  return matched || null;
}

function formatSceneModeReply(rawText) {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';

  const dialogRegex = /["“”]([^"“”]+)["“”]/g;
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return trimmed;

  const narrations = [];
  const dialogues = [];

  for (const line of lines) {
    if (!line) continue;
    let remainder = line;
    let match;
    while ((match = dialogRegex.exec(line)) !== null) {
      const spoken = match[1].trim();
      if (spoken) dialogues.push(spoken);
    }
    remainder = remainder.replace(dialogRegex, '').replace(/^\*+|\*+$/g, '').trim();
    if (remainder) narrations.push(remainder);
  }

  const results = [];
  if (narrations.length) {
    results.push(`*${narrations.shift()}*`);
  }

  while (dialogues.length || narrations.length) {
    if (dialogues.length) {
      const dialogue = dialogues.shift();
      if (dialogue) results.push(`"${dialogue}"`);
    }
    if (narrations.length) {
      const narration = narrations.shift();
      if (narration) results.push(`*${narration}*`);
    }
  }

  if (!results.length && trimmed) {
    results.push(`*${trimmed}*`);
  } else if (results.length === 1 && dialogues.length) {
    const dialogue = dialogues.shift();
    if (dialogue) results.push(`"${dialogue}"`);
  }

  return results.filter(Boolean).join('\n');
}

/**
 * 怨듭슜: ?붿껌?먯꽌 ?꾩옱 ?좎? ?뺣낫 媛?몄삤湲?
 *
 * - ?쇰컲?곸씤 諛⑹떇:
 *   ?꾨줎?몄뿉??Supabase access_token??
 *   Authorization: Bearer <token> ?쇰줈 蹂대궡以??
 *
 *   const { data: { session } } = await sb.auth.getSession();
 *   fetch("/api/...", {
 *     headers: { Authorization: `Bearer ${session.access_token}` }
 *   })
 */
const authCache = new Map(); // token -> { user, expiresAt }
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getUserFromRequest(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;

  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
  authCache.set(token, { user: data.user, expiresAt });

  return data.user; // { id, email, ... }
}

// ===============================
// Creator feed routes
// ===============================
function ensureFeedOwner(user, targetUserId, res) {
  if (!user) {
    sendError(res, 401, "unauthorized");
    return false;
  }
  if (user.id !== targetUserId) {
    sendError(res, 403, "forbidden");
    return false;
  }
  return true;
}

app.get("/api/creator-feed", async (req, res) => {
  const targetUserId = String(req.query.user_id || "").trim();
  if (!targetUserId) return sendError(res, 400, "user_id_required");
  const viewer = await getUserFromRequest(req);
  const cursorPayload = decodeFeedCursor(req.query.cursor);

  const sorted = creatorFeedStore.posts
    .filter((post) => post.owner_id === targetUserId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  let startIndex = 0;
  if (cursorPayload?.id) {
    const idx = sorted.findIndex((post) => post.id === cursorPayload.id);
    if (idx >= 0) startIndex = idx + 1;
  }
  const pageItems = sorted.slice(startIndex, startIndex + CREATOR_FEED_PAGE_SIZE);
  const nextIndex = startIndex + pageItems.length;
  const nextCursor =
    nextIndex < sorted.length && pageItems.length
      ? encodeFeedCursor({ id: pageItems[pageItems.length - 1].id })
      : null;

  const items = pageItems.map((post) => mapPostToResponse(post, viewer?.id));
  return res.json({
    items,
    next_cursor: nextCursor,
  });
});

app.post("/api/creator-feed", async (req, res) => {
  const user = await getUserFromRequest(req);
  const targetUserId = String(req.body?.user_id || "").trim() || user?.id;
  if (!ensureFeedOwner(user, targetUserId, res)) return;
  const content = sanitizeFeedContent(req.body?.content);
  if (!content) return sendError(res, 400, "content_required");
  const imageUrl = sanitizeFeedImageUrl(req.body?.image_url);

  const now = new Date().toISOString();
  const post = {
    id: `post_${crypto.randomUUID()}`,
    owner_id: targetUserId,
    content,
    created_at: now,
    updated_at: now,
    like_user_ids: [],
    type: "characters",
    image_url: imageUrl,
    author_snapshot: buildAuthorSnapshot(user),
  };
  creatorFeedStore.posts.unshift(post);
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true, id: post.id });
});

app.put("/api/creator-feed/:postId", async (req, res) => {
  const user = await getUserFromRequest(req);
  const post = findPostById(req.params.postId);
  if (!post) return sendError(res, 404, "post_not_found");
  if (!ensureFeedOwner(user, post.owner_id, res)) return;
  const content = sanitizeFeedContent(req.body?.content);
  if (!content) return sendError(res, 400, "content_required");
  const imageUrl = sanitizeFeedImageUrl(req.body?.image_url);
  post.content = content;
  post.image_url = imageUrl;
  post.updated_at = new Date().toISOString();
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true });
});

app.delete("/api/creator-feed/:postId", async (req, res) => {
  const user = await getUserFromRequest(req);
  const postIndex = creatorFeedStore.posts.findIndex(
    (p) => p.id === req.params.postId
  );
  if (postIndex === -1) return sendError(res, 404, "post_not_found");
  const post = creatorFeedStore.posts[postIndex];
  if (!ensureFeedOwner(user, post.owner_id, res)) return;
  creatorFeedStore.posts.splice(postIndex, 1);
  removePostComments(post.id);
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true });
});

app.post("/api/creator-feed/:postId/like", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const post = findPostById(req.params.postId);
  if (!post) return sendError(res, 404, "post_not_found");
  post.like_user_ids = Array.isArray(post.like_user_ids) ? post.like_user_ids : [];
  if (!post.like_user_ids.includes(user.id)) {
    post.like_user_ids.push(user.id);
    persistCreatorFeedStore(creatorFeedStore);
  }
  return res.json({ ok: true, like_count: post.like_user_ids.length, liked: true });
});

app.delete("/api/creator-feed/:postId/like", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const post = findPostById(req.params.postId);
  if (!post) return sendError(res, 404, "post_not_found");
  post.like_user_ids = Array.isArray(post.like_user_ids) ? post.like_user_ids : [];
  const nextLikes = post.like_user_ids.filter((id) => id !== user.id);
  if (nextLikes.length !== post.like_user_ids.length) {
    post.like_user_ids = nextLikes;
    persistCreatorFeedStore(creatorFeedStore);
  } else {
    post.like_user_ids = nextLikes;
  }
  return res.json({ ok: true, like_count: post.like_user_ids.length, liked: false });
});

app.get("/api/creator-feed/:postId", async (req, res) => {
  const viewer = await getUserFromRequest(req);
  const post = findPostById(req.params.postId);
  if (!post) return sendError(res, 404, "post_not_found");
  const detail = {
    ...mapPostToResponse(post, viewer?.id),
    comments: buildCommentTree(post.id, viewer?.id),
  };
  return res.json(detail);
});

app.post("/api/creator-feed/:postId/comments", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const post = findPostById(req.params.postId);
  if (!post) return sendError(res, 404, "post_not_found");
  const content = sanitizeFeedContent(req.body?.content);
  if (!content) return sendError(res, 400, "content_required");
  const parentId = req.body?.parent_id ? String(req.body.parent_id).trim() : null;
  if (parentId) {
    const parentComment = findCommentById(parentId);
    if (!parentComment || parentComment.post_id !== post.id) {
      return sendError(res, 404, "parent_comment_not_found");
    }
  }
  const now = new Date().toISOString();
  creatorFeedStore.comments.push({
    id: `comment_${crypto.randomUUID()}`,
    post_id: post.id,
    parent_id: parentId || null,
    user_id: user.id,
    content,
    created_at: now,
    updated_at: now,
    like_user_ids: [],
    author_snapshot: buildAuthorSnapshot(user),
  });
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true });
});

app.put("/api/creator-feed/:postId/comments/:commentId", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const comment = findCommentById(req.params.commentId);
  if (!comment || comment.post_id !== req.params.postId) {
    return sendError(res, 404, "comment_not_found");
  }
  if (comment.user_id !== user.id) {
    return sendError(res, 403, "forbidden");
  }
  const content = sanitizeFeedContent(req.body?.content);
  if (!content) return sendError(res, 400, "content_required");
  comment.content = content;
  comment.updated_at = new Date().toISOString();
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true });
});

app.delete("/api/creator-feed/:postId/comments/:commentId", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const comment = findCommentById(req.params.commentId);
  if (!comment || comment.post_id !== req.params.postId) {
    return sendError(res, 404, "comment_not_found");
  }
  if (comment.user_id !== user.id) {
    return sendError(res, 403, "forbidden");
  }
  removeCommentWithChildren(comment.id);
  persistCreatorFeedStore(creatorFeedStore);
  return res.json({ ok: true });
});

app.post("/api/creator-feed/:postId/comments/:commentId/like", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const comment = findCommentById(req.params.commentId);
  if (!comment || comment.post_id !== req.params.postId) {
    return sendError(res, 404, "comment_not_found");
  }
  comment.like_user_ids = Array.isArray(comment.like_user_ids) ? comment.like_user_ids : [];
  if (!comment.like_user_ids.includes(user.id)) {
    comment.like_user_ids.push(user.id);
    persistCreatorFeedStore(creatorFeedStore);
  }
  return res.json({ ok: true, liked: true, like_count: comment.like_user_ids.length });
});

app.delete("/api/creator-feed/:postId/comments/:commentId/like", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");
  const comment = findCommentById(req.params.commentId);
  if (!comment || comment.post_id !== req.params.postId) {
    return sendError(res, 404, "comment_not_found");
  }
  comment.like_user_ids = Array.isArray(comment.like_user_ids) ? comment.like_user_ids : [];
  const nextLikes = comment.like_user_ids.filter((id) => id !== user.id);
  if (nextLikes.length !== comment.like_user_ids.length) {
    comment.like_user_ids = nextLikes;
    persistCreatorFeedStore(creatorFeedStore);
  } else {
    comment.like_user_ids = nextLikes;
  }
  return res.json({ ok: true, liked: false, like_count: comment.like_user_ids.length });
});

// ===============================
// Profile handle helpers
// ===============================
app.post("/api/profile/ensure-handle", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, "unauthorized");

    const adminClient = requireAdmin(res);
    if (!adminClient) return;

    // fetch or create profile row
    let { data: profile, error } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return sendError(res, 500, "profile_fetch_error", { error: error.message });

    if (!profile) {
      const { data, error: insertErr } = await adminClient
        .from("profiles")
        .insert({ id: user.id })
        .select()
        .single();
      if (insertErr) return sendError(res, 500, "profile_create_error", { error: insertErr.message });
      profile = data;
    }

    if (profile.handle) {
      return res.json({ ok: true, handle: profile.handle, created: false });
    }

    const uniqueHandle = await generateUniqueHandle(adminClient);
    if (!uniqueHandle) return sendError(res, 500, "handle_generate_failed");

    // Try updating with handle_updated_at; fallback without if column missing
    const payload = { handle: uniqueHandle, handle_updated_at: new Date().toISOString() };
    let updatedHandle = null;
    let { data: updated, error: updateErr } = await adminClient
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("handle")
      .maybeSingle();

    if (updateErr && String(updateErr.message || "").includes("handle_updated_at")) {
      const { data: fallbackProfile, error: fallbackErr } = await adminClient
        .from("profiles")
        .update({ handle: uniqueHandle })
        .eq("id", user.id)
        .select("handle")
        .maybeSingle();
      if (fallbackErr) return sendError(res, 500, "profile_update_error", { error: fallbackErr.message });
      updatedHandle = fallbackProfile?.handle || uniqueHandle;
    } else if (updateErr) {
      return sendError(res, 500, "profile_update_error", { error: updateErr.message });
    } else {
      updatedHandle = updated?.handle || uniqueHandle;
    }

    // Persist last change in auth metadata as well
    const meta = await getUserMetadata(adminClient, user.id);
    meta.handle_updated_at = Date.now();
    await updateUserMetadata(adminClient, user.id, meta);

    return res.json({ ok: true, handle: updatedHandle, created: true });
  } catch (e) {
    console.error("ensure-handle error", e);
    return sendError(res, 500, "internal_error");
  }
});

app.post("/api/profile/change-handle", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, "unauthorized");

    const adminClient = requireAdmin(res);
    if (!adminClient) return;

    const requested = (req.body?.handle || "").trim().toLowerCase();
    if (!requested || requested.length < 3 || requested.length > 32) {
      return sendError(res, 400, "invalid_handle");
    }

    // Fetch profile; tolerate missing handle_updated_at column
    let profile = null;
    let columnMissing = false;
    {
      const { data, error } = await adminClient
        .from("profiles")
        .select("handle, handle_updated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error && String(error.message || "").includes("handle_updated_at")) {
        columnMissing = true;
        const { data: fallback, error: fallbackErr } = await adminClient
          .from("profiles")
          .select("handle")
          .eq("id", user.id)
          .maybeSingle();
        if (fallbackErr) return sendError(res, 500, "profile_fetch_error", { error: fallbackErr.message });
        profile = fallback;
      } else if (error) {
        return sendError(res, 500, "profile_fetch_error", { error: error.message });
      } else {
        profile = data;
      }
    }

    // Cooldown based on auth metadata; fallback to profile column if available
    const meta = await getUserMetadata(adminClient, user.id);
    let lastChanged = meta?.handle_updated_at ? new Date(meta.handle_updated_at) : null;
    if (!lastChanged && !columnMissing && profile?.handle_updated_at) {
      lastChanged = new Date(profile.handle_updated_at);
    }
    if (lastChanged && Date.now() - lastChanged.getTime() < HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) {
      const remainMs = HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - lastChanged.getTime());
      const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000));
      return sendError(res, 429, "handle_change_cooldown", { remainingDays: remainDays });
    }

    // uniqueness check
    const { data: exists, error: existsErr } = await adminClient
      .from("profiles")
      .select("id")
      .eq("handle", requested)
      .maybeSingle();
    if (existsErr) return sendError(res, 500, "handle_check_error", { error: existsErr.message });
    if (exists) return sendError(res, 409, "handle_taken");

    const updatePayload = columnMissing
      ? { handle: requested }
      : { handle: requested, handle_updated_at: new Date().toISOString() };

    const { data: updated, error: updateErr } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select("handle")
      .maybeSingle();
    if (updateErr) return sendError(res, 500, "profile_update_error", { error: updateErr.message });

    const handleValue = updated?.handle || requested;

    // Persist last change in auth metadata
    meta.handle_updated_at = Date.now();
    await updateUserMetadata(adminClient, user.id, meta);

    return res.json({ ok: true, handle: handleValue });
  } catch (e) {
    console.error("change-handle error", e);
    return sendError(res, 500, "internal_error");
  }
});

// ===============================
// 湲곗〈 湲곕뒫 1: ?덊띁?곗뒪 寃??API
// POST /api/search-images
// ===============================
app.post("/api/search-images", async (req, res) => {
  const { prompt, keywords } = req.body;
  const query = [prompt, keywords].filter(Boolean).join(" ");
  const finalQuery = query || "abstract colorful gradient";

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        finalQuery
      )}&per_page=12&orientation=squarish`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Unsplash error:", await response.text());
      return res.status(500).json({ message: "unsplash error" });
    }

    const data = await response.json();

    const results = (data.results || []).map((item) => ({
      id: item.id,
      thumbUrl: item.urls.small,
      fullUrl: item.urls.full,
      tags: (item.tags || []).map((t) => t.title),
      source: `Unsplash 쨌 ${item.user.name}`,
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "image search error" });
  }
});

// ===============================
// 캐릭터 아바타 업로드 (data URL -> Storage)
// POST /api/upload/avatar
// ===============================
app.post("/api/upload/avatar", async (req, res) => {
  const { dataUrl, fileName, bucket, folder } = req.body || {};
  const bucketName = bucket || AVATAR_BUCKET;
  const client = supabaseAdmin || supabase;

  if (!dataUrl) return sendError(res, 400, "dataUrl required");
  if (!client) return sendError(res, 500, "Supabase client not ready");

  let bufferInfo;
  try {
    bufferInfo = dataUrlToBuffer(dataUrl);
  } catch (e) {
    return sendError(res, 400, "invalid dataUrl", { detail: e.message });
  }

  let uploadBuffer = bufferInfo.buffer;
  let uploadMime = "image/webp";

  try {
    uploadBuffer = await bufferToWebp(bufferInfo.buffer);
  } catch (conversionError) {
    console.warn("webp conversion failed, fallback to original buffer", conversionError);
    uploadBuffer = bufferInfo.buffer;
    uploadMime = bufferInfo.contentType || "image/png";
  }

  const ext = (uploadMime.split("/")[1] || "png").split(";")[0];
  const safeName = (fileName || "avatar").replace(/[^a-zA-Z0-9_.-]/g, "");
  const folderName = (folder || "avatars").toString().replace(/[^a-zA-Z0-9/_-]/g, "");
  const normalizedFolder = folderName.replace(/^\/+|\/+$/g, "") || "avatars";
  const objectPath = `${normalizedFolder}/${Date.now()}_${safeName || "avatar"}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(bucketName)
    .upload(objectPath, uploadBuffer, {
      cacheControl: "3600",
      upsert: true,
      contentType: uploadMime,
    });

  if (uploadError) {
    return sendError(res, 500, "avatar upload failed", { detail: uploadError.message });
  }

  const { data: publicData } = client.storage.from(bucketName).getPublicUrl(objectPath);
  return res.json({
    ok: true,
    url: publicData?.publicUrl || "",
    path: objectPath,
  });
});

// ===============================
// 캐릭터 좋아요 증가
// POST /api/characters/:id/like
// ===============================
app.post('/api/characters/:id/like', async (req, res) => {
  const { id } = req.params;
  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");

  const client = supabaseAdmin || supabase;

  try {
    const { data: row, error: selectErr } = await client
      .from('characters')
      .select('like_count')
      .eq('id', id)
      .single();

    if (selectErr) {
      console.error('like select error', selectErr);
      return sendError(res, 500, "select_failed", { error: selectErr.message });
    }

    const current = row?.like_count ?? 0;
    const next = current + 1;

    const { error: updateErr } = await client
      .from('characters')
      .update({ like_count: next })
      .eq('id', id);

    if (updateErr) {
      console.error('like update error', updateErr);
      return sendError(res, 500, "update_failed", { error: updateErr.message });
    }

    return res.json({ like_count: next });
  } catch (e) {
    console.error('like exception', e);
    return sendError(res, 500, "internal_error");
  }
});

// ===============================
// 캐릭터 통계 (좋아요/조회수는 characters 테이블 값 사용, 채팅 수는 로그 집계)
// GET /api/characters/:id/stats
// ===============================
app.get('/api/characters/:id/stats', async (req, res) => {
  const { id } = req.params;
  const client = supabaseAdmin || supabase;

  try {
    const [{ data: characterRow, error: characterError }, { count: chatCount, error: chatError }] =
      await Promise.all([
        client
          .from('characters')
          .select('like_count, view_count')
          .eq('id', id)
          .single(),
        client
          .from('character_chats')
          .select('id', { count: 'exact', head: true })
          .eq('character_id', id),
      ]);

    if (characterError) {
      console.error('stats characterError', characterError);
    }
    if (chatError) {
      console.error('stats chatError', chatError);
    }

    return res.json({
      like_count: characterRow?.like_count ?? 0,
      view_count: characterRow?.view_count ?? 0,
      chat_count: typeof chatCount === 'number' ? chatCount : characterRow?.chat_count ?? 0,
    });
  } catch (e) {
    console.error('character stats error', e);
    return res.status(500).json({ error: 'stats_error' });
  }
});

// ===============================
// 패션: 의상 교체 (OpenAI 이미지)
// POST /api/fashion/replace-outfit
// ===============================
app.post("/api/fashion/replace-outfit", async (req, res) => {
  try {
    const { baseImage, refImage, maskImage, prompt } = req.body || {};
    if (!baseImage) return sendError(res, 400, "baseImage is required");

    // Require login and credit check
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, "unauthorized");

    const creditDb = supabaseAdmin || supabase;

    const { data: wallet, error: walletErr } = await creditDb
      .from("credit_wallets")
      .select("balance, lifetime_used")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletErr) {
      console.error("fashion wallet error", walletErr);
      return sendError(res, 500, "wallet_error", { error: walletErr.message });
    }

    const currentBalance = wallet?.balance ?? 0;
    if (currentBalance < FASHION_CREDIT_COST) {
      return sendError(res, 402, "insufficient_credits", {
        required: FASHION_CREDIT_COST,
        balance: currentBalance,
      });
    }

    async function chargeAndRespond(payload) {
      const newBalance = currentBalance - FASHION_CREDIT_COST;
      const txPayload = {
        user_id: user.id,
        subscription_id: null,
        tx_type: CREDIT_TX_TYPE_SPEND,
        service_code: "FASHION",
        amount: -FASHION_CREDIT_COST,
        balance_after: newBalance,
        description: "fashion replace-outfit",
        metadata: { model: payload.model },
      };
      if (CREDIT_CATEGORY_FASHION) txPayload.category = CREDIT_CATEGORY_FASHION;

      const { error: txError } = await creditDb.from("credit_transactions").insert(txPayload);
      if (txError) {
        console.error("fashion tx error", txError);
        return sendError(res, 500, "tx_error", { error: txError.message });
      }

      const { error: walletUpdateErr } = await supabase.from("credit_wallets").upsert({
        user_id: user.id,
        balance: newBalance,
        lifetime_used: (wallet?.lifetime_used ?? 0) + FASHION_CREDIT_COST,
        updated_at: new Date().toISOString(),
      });
      if (walletUpdateErr) {
        console.error("fashion wallet update error", walletUpdateErr);
        return sendError(res, 500, "wallet_update_error", { error: walletUpdateErr.message });
      }

      return res.json({
        ...payload,
        credit: { spent: FASHION_CREDIT_COST, balance: newBalance },
      });
    }

    // If Stability key is present, prefer Stability img2img for stronger layout preservation
    if (STABILITY_API_KEY) {
      // Expect baseImage (and optional refImage) as data URLs; convert to buffer
      const { buffer: baseBuf, contentType } = dataUrlToBuffer(baseImage);
      const refHint = refImage ? "Reference outfit image is provided." : "No reference image.";
      const promptText = [
        prompt || "",
        "Keep the original person, pose, face, hair, hands, skin tone, shoes, lighting, and background exactly as in the base image.",
        "Only replace the clothing/accessories mentioned (e.g., tops, bottoms, watch). If an item is not mentioned, leave it unchanged.",
        refHint,
      ]
        .filter(Boolean)
        .join(" ");

      const form = new FormData();
      const mime = contentType || "image/png";
      const ext = mime.split("/")[1] || "png";
      const blob = new Blob([baseBuf], { type: mime });
      form.append("init_image", blob, `base.${ext}`);
      form.append("cfg_scale", "7");
      form.append("samples", "1");
      form.append("steps", "35");
      form.append("text_prompts[0][text]", promptText);
      form.append("text_prompts[0][weight]", "1");

      if (maskImage) {
        const { buffer: maskBuf, contentType: maskType } = dataUrlToBuffer(maskImage);
        const maskMime = maskType || "image/png";
        const maskExt = maskMime.split("/")[1] || "png";
        const maskBlob = new Blob([maskBuf], { type: maskMime });
        form.append("mask_image", maskBlob, `mask.${maskExt}`);

        const stabilityRes = await fetch(
          "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STABILITY_API_KEY}`,
            },
            body: form,
          }
        );

        if (!stabilityRes.ok) {
          const errText = await stabilityRes.text();
          console.error("stability error", errText);
          return sendError(res, stabilityRes.status || 500, "stability generation failed", {
            error: errText,
          });
        }

        const stabilityJson = await stabilityRes.json();
        const art = stabilityJson?.artifacts?.[0];
        if (!art?.base64) {
          return sendError(res, 500, "stability generation failed", { raw: stabilityJson });
        }

        return await chargeAndRespond({
          ok: true,
          model: "stability-sdxl-inpaint",
          dataUrl: `data:image/png;base64,${art.base64}`,
          imageUrl: null,
        });
      } else {
        form.append("image_strength", "0.35");
        const stabilityRes = await fetch(
          "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STABILITY_API_KEY}`,
            },
            body: form,
          }
        );

        if (!stabilityRes.ok) {
          const errText = await stabilityRes.text();
          console.error("stability error", errText);
          return sendError(res, stabilityRes.status || 500, "stability generation failed", {
            error: errText,
          });
        }

        const stabilityJson = await stabilityRes.json();
        const art = stabilityJson?.artifacts?.[0];
        if (!art?.base64) {
          return sendError(res, 500, "stability generation failed", { raw: stabilityJson });
        }

        return await chargeAndRespond({
          ok: true,
          model: "stability-sdxl-img2img",
          dataUrl: `data:image/png;base64,${art.base64}`,
          imageUrl: null,
        });
      }
    }

    // Fallback: OpenAI text-to-image (layout not guaranteed)
    const systemText =
      "Replace only the outfits/accessories requested. Keep the original person, pose, face, hair, hands, skin tone, shoes, lighting, and background unchanged.";
    const userText =
      prompt ||
      "Use the second picture as reference if present. Modify only the specified clothing parts; leave all other regions untouched.";

    const promptText = `${systemText}${userText}Only change clothing/accessories that are explicitly mentioned; everything else must remain identical to the base image.`;

    const result = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: promptText,
      n: 1,
      size: "1024x1024",
    });

    const item = result.data?.[0];
    const dataUrl = item?.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : null;
    const imageUrl = item?.url || null;

    if (!dataUrl && !imageUrl) {
      return sendError(res, 500, "image generation failed", { raw: item });
    }

    return await chargeAndRespond({
      ok: true,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      dataUrl,
      imageUrl,
    });
  } catch (err) {
    console.error("fashion replace error:", err);
    return sendError(res, 500, "replace failed", { error: err?.message });
  }
});
// ===============================
// Image generation API (Stability first, with credit charge)
// POST /api/generate-images
// ===============================
app.post("/api/generate-images", async (req, res) => {
  const {
    prompt,
    keywords,
    referenceUrls = [],
    mode = "direct",
    ratio = "1:1",
    count = 2,
    style,
    stylePrompt,
    baseImage,
    maskImage,
  } = req.body || {};

  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, "unauthorized");

  const creditDb = supabaseAdmin || supabase;
  const { data: wallet, error: walletErr } = await creditDb
    .from("credit_wallets")
    .select("balance, lifetime_used")
    .eq("user_id", user.id)
    .maybeSingle();

  if (walletErr) {
    console.error("studio wallet error", walletErr);
    return sendError(res, 500, "wallet_error", { error: walletErr.message });
  }

  const currentBalance = wallet?.balance ?? 0;
  if (currentBalance < STUDIO_CREDIT_COST) {
    return sendError(res, 402, "insufficient_credits", {
      required: STUDIO_CREDIT_COST,
      balance: currentBalance,
    });
  }

  const keywordText = keywords ? `Keywords: ${keywords}` : "";
  const refText =
    referenceUrls.length > 0
      ? `Use these image URLs only as style/pose reference (do NOT copy exactly):${referenceUrls
          .map((u, i) => `${i + 1}. ${u}`)
          .join("")}`
      : "";
  const styleText = style ? `Style: ${style}` : "";
  const stylePromptText = stylePrompt ? `Style prompt: ${stylePrompt}` : "";

  const finalPrompt =
    (prompt && prompt.trim().length > 0
      ? prompt.trim()
      : "A clean, colorful illustration, high quality, 4k") +
    keywordText +
    styleText +
    stylePromptText +
    refText;

  const samples = Math.max(1, Math.min(Number(count) || 1, 4));
  const ratioMap = {
    "1:1": { width: 1024, height: 1024 },
    "4:3": { width: 1152, height: 896 },
    "3:4": { width: 896, height: 1152 },
    "16:9": { width: 1536, height: 640 },
    "9:16": { width: 640, height: 1536 },
  };
  const { width, height } = ratioMap[ratio] || ratioMap["1:1"];
  const openAiSizeMap = {
    "1:1": "1024x1024",
    "4:3": "1536x1024",
    "3:4": "1024x1536",
    "16:9": "1536x1024",
    "9:16": "1024x1536",
  };
  const openAiSize = openAiSizeMap[ratio] || openAiSizeMap["1:1"];

  console.log("스튜디오 [generate-images] mode=", mode, "ratio=", ratio, "samples=", samples);
  console.log("prompt length:", finalPrompt.length);

  if (mode === "transform") {
    if (!STABILITY_API_KEY) {
      return sendError(res, 500, "stability_unavailable");
    }
    if (!baseImage) {
      return sendError(res, 400, "base_image_required");
    }
    try {
      const basePrepared = await prepareImageForStability(baseImage);
      const form = new FormData();
      const baseMime = basePrepared.contentType || "image/png";
      const baseExt = (baseMime.split("/")[1] || "png").split(";")[0];
      const baseBlob = new Blob([basePrepared.buffer], { type: baseMime });
      form.append("init_image", baseBlob, `base.${baseExt}`);
      form.append("cfg_scale", "7");
      form.append("samples", String(samples));
      form.append("steps", "35");
      form.append("text_prompts[0][text]", finalPrompt);
      form.append("text_prompts[0][weight]", "1");

      let endpoint =
        "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image";
      if (maskImage) {
        const maskPrepared = await prepareImageForStability(maskImage, {
          enforcedDims: basePrepared.dimensions,
          preferPng: true,
        });
        const maskMime = maskPrepared.contentType || "image/png";
        const maskExt = (maskMime.split("/")[1] || "png").split(";")[0];
        const maskBlob = new Blob([maskPrepared.buffer], { type: maskMime });
        form.append("mask_image", maskBlob, `mask.${maskExt}`);
        endpoint =
          "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking";
      } else {
        form.append("image_strength", "0.35");
      }

      const stabilityRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        body: form,
      });

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        console.error("stability img2img error", errText);
        return sendError(res, stabilityRes.status || 500, "stability_generation_failed", {
          error: errText,
        });
      }

      const stabilityJson = await stabilityRes.json();
      const artifacts = stabilityJson?.artifacts || [];
      const images = artifacts
        .map((art) => (art?.base64 ? `data:image/png;base64,${art.base64}` : null))
        .filter(Boolean)
        .slice(0, samples);
      if (!images.length) {
        return sendError(res, 500, "stability_generation_failed");
      }
      return await chargeAndRespond("stability-sdxl-img2img", images);
    } catch (err) {
      console.error("studio transform error", err);
      return sendError(res, 500, "transform_error", { error: err?.message || "transform_failed" });
    }
  }

  async function chargeAndRespond(model, images) {
    const newBalance = currentBalance - STUDIO_CREDIT_COST;
    const txPayload = {
      user_id: user.id,
      subscription_id: null,
      tx_type: CREDIT_TX_TYPE_SPEND,
      service_code: SERVICE_CODE_STUDIO,
      amount: -STUDIO_CREDIT_COST,
      balance_after: newBalance,
      description: "studio generate-images",
      metadata: { model, count: samples, ratio },
    };
    if (CREDIT_CATEGORY_STUDIO) txPayload.category = CREDIT_CATEGORY_STUDIO;

    const { error: txError } = await creditDb.from("credit_transactions").insert(txPayload);
    if (txError) {
      console.error("studio tx error", txError);
      return sendError(res, 500, "tx_error", { error: txError.message });
    }

    const { error: walletUpdateErr } = await supabase.from("credit_wallets").upsert({
      user_id: user.id,
      balance: newBalance,
      lifetime_used: (wallet?.lifetime_used ?? 0) + STUDIO_CREDIT_COST,
      updated_at: new Date().toISOString(),
    });
    if (walletUpdateErr) {
      console.error("studio wallet update error", walletUpdateErr);
      return sendError(res, 500, "wallet_update_error", { error: walletUpdateErr.message });
    }

    // Save to user_contents for drawer/history
    try {
      const cleaned = (images || []).filter(Boolean);
      const insertRows = cleaned.map((imgUrl, idx) => {
        return {
          user_id: user.id,
          service_code: SERVICE_CODE_STUDIO,
          kind: "image",
          title:
            (prompt &&
              prompt.slice(0, 20) + (prompt.length > 20 ? "..." : "")) ||
            `이미지 ${idx + 1}`,
          prompt,
          thumb_url: imgUrl,
          full_url: imgUrl,
          created_at: new Date().toISOString(),
          extra: { style, stylePrompt, ratio, index: idx, mode },
        };
      });
      if (insertRows.length > 0) {
        const { error: insertErr } = await creditDb.from("user_contents").insert(insertRows);
        if (insertErr) {
          console.error("user_contents insert error (studio)", insertErr);
        }
      }
    } catch (e) {
      console.warn("user_contents insert error (studio)", e);
    }

    return res.json({
      ok: true,
      images,
      credit: { spent: STUDIO_CREDIT_COST, balance: newBalance },
      model,
    });
  }

  try {
    let images = [];
    let modelUsed = "stability-sdxl";

    if (STABILITY_API_KEY) {
      const stabilityRes = await fetch(
        "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STABILITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text_prompts: [{ text: finalPrompt }],
            cfg_scale: 8,
            steps: 35,
            samples,
            width,
            height,
          }),
        }
      );

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        console.error("stability text2img error", errText);
        modelUsed = "openai-fallback";
      } else {
        const stabilityJson = await stabilityRes.json();
        images = (stabilityJson?.artifacts || [])
          .map((art) => (art?.base64 ? `data:image/png;base64,${art.base64}` : null))
          .filter(Boolean)
          .slice(0, samples);
      }
    } else {
      modelUsed = "openai-fallback";
    }

    if ((!images || images.length === 0) && OPENAI_API_KEY) {
      const result = await openai.images.generate({
        model: OPENAI_IMAGE_MODEL,
        prompt: finalPrompt,
        n: samples,
        size: openAiSize,
      });

      images = (result.data || [])
        .map((item) => {
          if (item.url) return item.url;
          if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
          return null;
        })
        .slice(0, samples);
    }

    if (!images || images.length === 0) {
      return sendError(res, 500, "image_generation_failed");
    }

    console.log("✅ studio images generated:", images.length);

    // Store generated images to Supabase storage bucket for persistent access
    async function uploadStudioImages(urls) {
      if (!supabaseAdmin) return urls; // storage upload requires service role

      const uploaded = [];
      for (let i = 0; i < urls.length; i++) {
        const src = urls[i];
        try {
          let buffer;
          let contentType = "image/png";

          if (src?.startsWith("data:")) {
            const parsed = dataUrlToBuffer(src);
            buffer = parsed.buffer;
            contentType = parsed.contentType || "image/png";
          } else {
            const res = await fetch(src);
            if (!res.ok) throw new Error(`fetch image failed ${res.status}`);
            const arr = await res.arrayBuffer();
            buffer = Buffer.from(arr);
            contentType = res.headers.get("content-type") || "image/png";
          }

          const ext = (contentType.split("/")[1] || "png").split("+")[0];
          const filename = `${user.id}/${Date.now()}_${i}.${ext}`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from(STUDIO_BUCKET)
            .upload(filename, buffer, { contentType, upsert: false });
          if (uploadErr) throw uploadErr;

          const { data: publicUrlData } = supabaseAdmin.storage
            .from(STUDIO_BUCKET)
            .getPublicUrl(filename);
          uploaded.push(publicUrlData?.publicUrl || src);
        } catch (e) {
          console.error("studio image upload error", e);
          uploaded.push(src); // fallback to original
        }
      }
      return uploaded;
    }

    const storedImages = await uploadStudioImages(images);
    return await chargeAndRespond(modelUsed, storedImages);
  } catch (err) {
    console.error("❌ studio image error:", err);
    return res.status(500).json({
      message: "image generate error",
      error: err?.message || "unknown internal error (check server log)",
    });
  }
});

const CREDIT_SYSTEM = {
  dailyWelcome: {
    enabled: DAILY_WELCOME_ENABLED,
    credits: DAILY_WELCOME_ENABLED ? DAILY_WELCOME_CREDIT_AMOUNT : 0,
    maxPerDay: DAILY_WELCOME_ENABLED ? DAILY_WELCOME_MAX_PER_DAY : 0,
  },
  adReward: {
    credits: 5, // 愿묎퀬 1?뚮떦 吏湲??щ젅??
    maxPerDay: 3, // ?섎（ 理쒕? 愿묎퀬 蹂댁긽 ?잛닔
  },
};
function applyDailyWelcomeFilter(query) {
  let scoped = query.eq('service_code', 'DAILY_WELCOME');
  if (CREDIT_CATEGORY_DAILY_WELCOME) {
    scoped = scoped.eq('category', CREDIT_CATEGORY_DAILY_WELCOME);
  }
  return scoped;
}
// Throttle noisy credit-config logs when Supabase is flaky
const CREDIT_CONFIG_LOG_COOLDOWN_MS = 60_000;
let lastCreditConfigLog = 0;

// ===============================
// Daily welcome credits
// ===============================
app.get('/api/daily-welcome', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, 'unauthorized');

    const config = CREDIT_SYSTEM.dailyWelcome || {};
    const enabled = !!config.enabled && config.credits > 0 && config.maxPerDay > 0;
    const responseBase = {
      success: true,
      enabled,
      amount: config.credits || 0,
      maxPerDay: config.maxPerDay || 0,
    };

    if (!enabled) {
      return res.json({
        ...responseBase,
        canClaim: false,
        claimedToday: 0,
        balance: null,
        nextReset: null,
        lastClaimedAt: null,
      });
    }

    const creditDb = supabaseAdmin || supabase;
    const { start, next } = getDailyResetTimes();
    const startIso = start.toISOString();

    let todayQuery = creditDb
      .from('credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .gte('occurred_at', startIso);
    todayQuery = applyDailyWelcomeFilter(todayQuery);
    const { data: todayRows, error: todayErr } = await todayQuery;
    if (todayErr) {
      console.error('daily-welcome today lookup error', todayErr);
      return sendError(res, 500, 'daily_welcome_lookup_error', { error: todayErr.message });
    }

    let lastQuery = creditDb
      .from('credit_transactions')
      .select('occurred_at, created_at')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(1);
    lastQuery = applyDailyWelcomeFilter(lastQuery);
    let lastRow = null;
    const { data: lastData, error: lastErr } = await lastQuery.maybeSingle();
    if (lastErr && lastErr.code !== 'PGRST116') {
      console.warn('daily-welcome last lookup error (ignored)', lastErr);
    } else {
      lastRow = lastData || null;
    }

    const { data: wallet, error: walletErr } = await creditDb
      .from('credit_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();
    if (walletErr) {
      console.error('daily-welcome wallet error', walletErr);
      return sendError(res, 500, 'wallet_error', { error: walletErr.message });
    }

    const claimedToday = todayRows?.length || 0;
    const canClaim = enabled && claimedToday < (config.maxPerDay || 0);

    return res.json({
      ...responseBase,
      canClaim,
      claimedToday,
      balance: wallet?.balance ?? 0,
      nextReset: next.toISOString(),
      lastClaimedAt: lastRow?.occurred_at || lastRow?.created_at || null,
    });
  } catch (e) {
    console.error('daily-welcome status exception', e);
    return sendError(res, 500, 'daily_welcome_status_error');
  }
});

app.post('/api/daily-welcome', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, 'unauthorized');

    const config = CREDIT_SYSTEM.dailyWelcome || {};
    const enabled = !!config.enabled && config.credits > 0 && config.maxPerDay > 0;
    if (!enabled) {
      return res.status(400).json({
        success: false,
        error: 'daily_welcome_disabled',
        message: 'Daily welcome credits are not active.',
      });
    }

    const creditDb = supabaseAdmin || supabase;
    const { start, next } = getDailyResetTimes();
    const startIso = start.toISOString();

    let todayQuery = creditDb
      .from('credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .gte('occurred_at', startIso);
    todayQuery = applyDailyWelcomeFilter(todayQuery);
    const { data: todayRows, error: todayErr } = await todayQuery;
    if (todayErr) {
      console.error('daily-welcome claim lookup error', todayErr);
      return sendError(res, 500, 'daily_welcome_lookup_error', { error: todayErr.message });
    }

    const claimedToday = todayRows?.length || 0;
    if (claimedToday >= (config.maxPerDay || 0)) {
      return res.status(429).json({
        success: false,
        error: 'limit_reached',
        claimedToday,
        maxPerDay: config.maxPerDay || 0,
        nextReset: next.toISOString(),
      });
    }

    const { data: wallet, error: walletErr } = await creditDb
      .from('credit_wallets')
      .select('balance, lifetime_used')
      .eq('user_id', user.id)
      .maybeSingle();
    if (walletErr) {
      console.error('daily-welcome wallet error', walletErr);
      return sendError(res, 500, 'wallet_error', { error: walletErr.message });
    }

    const currentBalance = wallet?.balance ?? 0;
    const newBalance = currentBalance + (config.credits || 0);
    const occurredAt = new Date().toISOString();

    const txPayload = {
      user_id: user.id,
      subscription_id: null,
      tx_type: 'earn',
      service_code: 'DAILY_WELCOME',
      amount: config.credits || 0,
      balance_after: newBalance,
      description: 'daily welcome credit',
      occurred_at: occurredAt,
      metadata: { source: 'daily_welcome' },
    };
    if (CREDIT_CATEGORY_DAILY_WELCOME) {
      txPayload.category = CREDIT_CATEGORY_DAILY_WELCOME;
    }

    const { error: txError } = await creditDb.from('credit_transactions').insert(txPayload);
    if (txError) {
      console.error('daily-welcome tx error', txError);
      return sendError(res, 500, 'tx_error', { error: txError.message });
    }

    const { error: walletUpdateErr } = await creditDb.from('credit_wallets').upsert({
      user_id: user.id,
      balance: newBalance,
      lifetime_used: wallet?.lifetime_used ?? 0,
      updated_at: occurredAt,
    });
    if (walletUpdateErr) {
      console.error('daily-welcome wallet update error', walletUpdateErr);
      return sendError(res, 500, 'wallet_update_error', { error: walletUpdateErr.message });
    }

    const totalClaimed = claimedToday + 1;
    return res.json({
      success: true,
      amount: config.credits || 0,
      balance: newBalance,
      claimedToday: totalClaimed,
      maxPerDay: config.maxPerDay || 0,
      canClaim: totalClaimed < (config.maxPerDay || 0),
      nextReset: next.toISOString(),
      lastClaimedAt: occurredAt,
    });
  } catch (e) {
    console.error('daily-welcome claim exception', e);
    return sendError(res, 500, 'daily_welcome_claim_error');
  }
});

/**
 * 罹먮┃???뺣낫 議고쉶 (?곸꽭 ?붾㈃??
 */
app.get('/api/characters/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

/**
 * 梨꾪똿 濡쒓렇 議고쉶 (理쒓렐 50媛?
 */
app.get('/api/characters/:id/chats', async (req, res) => {
  const { id } = req.params;
  const { sessionId, since, before, limit } = req.query;

  const user = await getUserFromRequest(req);
  if (!user) return sendError(res, 401, 'unauthorized');

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  const baseQuery = (targetSessionId) => {
    const q = supabase
      .from('character_chats')
      .select('*')
      .eq('character_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (targetSessionId) q.eq('session_id', targetSessionId);
    if (since) q.gte('created_at', since);
    if (before) q.lt('created_at', before);
    return q;
  };

  let responseSessionId = sessionId || null;
  let { data, error } = await baseQuery(sessionId);
  if (error) return res.status(500).json({ error: error.message });

  if ((!data || !data.length) && sessionId) {
    const fallback = await baseQuery(null);
    if (!fallback.error && fallback.data?.length) {
      data = fallback.data;
      responseSessionId = fallback.data[0]?.session_id || responseSessionId;
    }
  }

  const sorted = (data || []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  if (!responseSessionId && sorted.length) {
    responseSessionId = sorted[sorted.length - 1]?.session_id || sorted[0]?.session_id || null;
  }
  if (responseSessionId) {
    res.set('x-chat-session-id', responseSessionId);
  }
  res.json(sorted);
});

app.get('/api/user-contents/images', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return sendError(res, 401, 'unauthorized');
    const adminClient = requireAdmin(res);
    if (!adminClient) return;
    const limit = safeInt(req.query.limit, 60, { min: 1 });
    const { data, error } = await adminClient
      .from('user_contents')
      .select('id, title, prompt, thumb_url, full_url, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'image')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      return sendError(res, 500, 'user_contents_fetch_failed', { error: error.message });
    }
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error('user contents fetch error', err);
    return sendError(res, 500, 'user_contents_fetch_failed');
  }
});

/**
 * 罹먮┃?곗? 梨꾪똿 (1??
 * body: { sessionId, message }
 */
app.post('/api/characters/:id/chat', async (req, res) => {
  const { id } = req.params;
  const {
    sessionId,
    message,
    sceneMode,
    chatModeKey,
    chatMode,
    tokenMultiplier
  } = req.body || {};

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'sessionId, message ?꾩슂' });
  }

  const requestedModeKey = chatModeKey || chatMode || null;
  const selectedModeConfig = getChatModeConfigByKey(requestedModeKey) || getDefaultChatModeConfig();
  const modeUsage = computeChatModeUsage(selectedModeConfig, tokenMultiplier);
  const modeSceneFlag = Boolean(selectedModeConfig?.sceneMode);
  const RESERVED_CREDIT_PER_MESSAGE = modeUsage.creditCost;

  // ?꾩옱 wallet 議고쉶 (?놁쑝硫?0?쇰줈 媛꾩＜), 罹먮┃??理쒓렐 ????숈떆 ?붿껌?쇰줈 ?뺣났 ?뚯닔 媛먯냼
  const creditDb = supabaseAdmin || supabase;

  const [walletResult, characterResult, recentResult] = await Promise.all([
    creditDb
      .from('credit_wallets')
      .select('balance, lifetime_used')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('characters')
      .select('id, name, prompt, intro, example_dialog, example_dialog_pairs, scene_image_templates')
      .eq('id', id)
      .single(),
    supabase
      .from('character_chats')
      .select('role, content, created_at')
      .eq('character_id', id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20)
  ]);

  const walletError = walletResult.error;
  const wallet = walletResult.data;
  if (walletError) {
    console.error('character chat walletError', walletError);
    return res.status(500).json({ error: 'wallet_error' });
  }

  let currentBalance = wallet?.balance ?? 0;

  // wallet 행이 없거나 값이 비어 있을 때, 트랜잭션 집계로 복구
  if (!wallet) {
    try {
      const { data: agg, error: aggErr } = await creditDb
        .from('credit_transactions')
        .select('amount')
        .eq('user_id', user.id);
      if (aggErr) {
        console.error('character chat tx aggregate error', aggErr);
      } else {
        const sum = (agg || []).reduce((acc, row) => acc + (row.amount || 0), 0);
        currentBalance = sum;
        await creditDb.from('credit_wallets').upsert({
          user_id: user.id,
          balance: sum,
          lifetime_used: 0,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('character chat wallet fallback error', e);
    }
  }
  if (currentBalance < RESERVED_CREDIT_PER_MESSAGE) {
    return res.status(402).json({
      error: 'insufficient_credits',
      required: RESERVED_CREDIT_PER_MESSAGE,
      balance: currentBalance
    });
  }

  const charErr = characterResult.error;
  const character = characterResult.data;
  if (charErr || !character) {
    return res.status(404).json({ error: 'character not found' });
  }
  console.log(
    '[character chat] character',
    id,
    'prompt length',
    character.prompt?.length || 0,
    'intro length',
    character.intro?.length || 0,
    'mode',
    selectedModeConfig?.key,
    'maxTokens',
    modeUsage.maxTokens
  );
  if (!character.prompt) {
    console.warn('[character chat] missing prompt for character', id);
  }

  const chatErr = recentResult.error;
  const recentMessages = recentResult.data;
  if (chatErr) {
    return res.status(500).json({ error: chatErr.message });
  }

  const sceneTemplates = sanitizeSceneTemplates(character.scene_image_templates || []);
  const examplePairs = parseExampleDialogPairs(character.example_dialog_pairs, character.example_dialog);
  const exampleMessages = buildExampleMessages(examplePairs);
  const sceneModeInput =
    typeof sceneMode === 'string'
      ? sceneMode.toLowerCase() === 'true'
      : Boolean(sceneMode);
  const sceneModeRequested = modeSceneFlag || sceneModeInput;
  const hasSceneTemplates = sceneTemplates.length > 0;
  const canAffordSceneMode = currentBalance >= (RESERVED_CREDIT_PER_MESSAGE + SCENE_IMAGE_CREDIT_COST);
  const sceneModeAllowed = sceneModeRequested && hasSceneTemplates && canAffordSceneMode;
  let sceneModeDeniedReason = null;
  if (sceneModeRequested && !hasSceneTemplates) {
    sceneModeDeniedReason = '등록된 상황 이미지가 없습니다.';
  } else if (sceneModeRequested && !canAffordSceneMode) {
    sceneModeDeniedReason = `scene이 부족하여 SCENE 모드를 사용할 수 없습니다. (추가 ${SCENE_IMAGE_CREDIT_COST} scene 필요)`;
  }

  // 3) LLM 프롬프트 구성
  const systemPrompt = `
너는 "${character.name}" 캐릭터로서만 대화한다.
아래 캐릭터 설정과 분위기를 철저히 따르며, 시스템적인 설명은 하지 않는다.

[캐릭터 설정]
${character.prompt ?? ''}

[인물 정보/배경]
${character.intro ?? ''}
`;

  let developerPrompt = `
Developer Message (공통 규칙)

당신은 사용자가 만든 캐릭터로 대화하는 AI입니다. 아래 규칙을 항상 우선 적용합니다.

1. 캐릭터 일관성 유지
- 언제나 캐릭터 생성자가 제공한 성격, 말투, 설정, 배경 스토리, 직업, 가치관, 관계관계, 금기 사항을 유지한다.
- 캐릭터 설정과 충돌하는 정보는 생성하지 않는다.
- 캐릭터 설정에 명시되지 않은 정보는 설정의 톤·세계관과 자연스럽게 맞는 범위 내에서만 창작한다.
- 대화 도중에도 캐릭터의 말투, 감정, 표현 방식이 변하지 않도록 한다.
- 사용자가 설정을 벗어난 질문을 하더라도, 캐릭터가 할 법한 방식으로 반응하며 일관성을 유지한다.

2. 캐릭터 생성자의 정보 기반 응답
- 응답의 1순위 기준은 캐릭터 생성자가 등록한 정보이다.
- 설정에 포함된 내용은 절대 부정하거나 무시하지 않는다.
- 캐릭터 설정이 비어 있는 영역에서는 설정의 분위기와 세계관을 유지하며 논리적·감정적으로 자연스러운 보조 정보를 창작한다.
- 설정에 명확한 내용이 있을 경우, 반드시 그 내용을 근거로 말한다.

3. 사용자 흐름 방해 금지
- 설정 설명, 규칙 설명 등 시스템적 안내문을 절대로 출력하지 않는다.
- 캐릭터로서 자연스럽게 대화하며, 캐릭터 외적인 언급(“나는 AI야”, “시스템 메시지 때문이야”)을 하지 않는다.
- 사용자가 캐릭터와 감정적·스토리적 흐름을 이어갈 때 이를 방해하지 않는다.

4. 금지 규칙
- 캐릭터 생성자가 금지한 표현·행동은 절대 하지 않는다.
- 정치적 주장/혐오/현실의 개인정보 언급 등 위험 요소는 캐릭터 세계관 내에서 안전하게 우회한다.
- 설정을 벗어난 정보 제공 요청은 캐릭터가 모르는 것으로 처리하되, 자연스러운 방식으로 대응한다.

5. 대사 및 묘사 형식
- 캐릭터가 직접 말하는 문장은 항상 큰따옴표(" ") 안에 작성해 독자가 구분할 수 있게 한다.
- 설명이나 장면 묘사를 작성할 때에는 인물의 표정, 몸짓, 주변 환경, 조명, 온도, 소리 등 감각 정보를 2~4문장 이상으로 충분히 묘사한다.
- 사용자가 *장면* 형태로 입력한 경우, 그 묘사를 응답 서두에서 받아 적고 캐릭터 대사와 자연스럽게 연결한다.
- 응답은 항상 "장면/상황 묘사 단락 → 큰따옴표 대사 단락" 순서를 지킨다. 장면 묘사는 반드시 별도의 단락으로 작성하고(필요 시 *…* 사용), 대사는 큰따옴표로만 작성한다. 추가 설명이 필요하면 이 두 단락을 순서대로 반복하되, 묘사와 대사를 하나의 단락에 섞어 쓰지 않는다.
`;

  if (sceneModeAllowed && sceneTemplates.length) {
    const catalogLines = sceneTemplates
      .map((tpl) => {
        const key = tpl.emotion_key || slugifyKey(tpl.label);
        const desc = tpl.description || (tpl.keywords?.join(', ') || '');
        return `- ${key}: ${tpl.label}${desc ? ` (${desc})` : ''}`;
      })
      .join('\n');
    developerPrompt += `
[SCENE 모드 지침]
- 아래 키워드 중 대화 상황과 감정이 맞는 경우에만 이미지를 호출한다.
${catalogLines}
- 이미지가 필요하다고 판단될 때는 응답 마지막 줄에 [[SCENE:키워드]] 형태로 명시한다.
- 이미지를 호출하면 추가 scene이 차감되므로 반드시 필요한 경우에만 태그를 추가한다.
- 한 응답에서는 최대 1개의 키워드만 사용하며, 필요하지 않으면 태그를 사용하지 않는다.
- 태그를 제외한 내용은 기존 대화 형식을 유지한다.
- 사용자가 *장면* 형태로 입력한 문장은 상황/시나리오 묘사로 이해하고 답변에 반영한다.
- SCENE 모드 응답은 다음 구조를 따른다:
  1) 첫 단락: 장면 묘사를 감각적으로 2문장 이상 작성(빛, 냄새, 표정, 자세 등 포함). 반드시 *…*로 감싸고 대사를 포함하지 않는다.
  2) 두 번째 단락부터는 반드시 큰따옴표로 시작하고 끝나는 캐릭터 대사만 작성한다. 추가 설명이 필요하면 "묘사 단락 → 대사 단락" 순서를 반복한다.
- 필요 시 장면 묘사 후 추가 설명을 덧붙여도 되지만, 묘사와 대사는 절대 하나의 단락에 혼용하지 않는다.`;
  }

  // 4-1) summary 저장소 조회
  let summaryText = '';
  const { data: summaryData } = await supabase
    .from('character_summaries')
    .select('id, summary, metadata, created_at')
    .eq('character_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (summaryData && summaryData.length > 0) {
    summaryText = summaryData[0].summary;
  }

  // 4-2) 모델 메시지 구성
  const messagesForModel = [
    { role: 'system', content: systemPrompt },
    { role: 'developer', content: developerPrompt }
  ];
  if (summaryText) {
    messagesForModel.push({ role: 'system', content: `[?κ린 ?붿빟]${summaryText}` });
  }
  if (exampleMessages.length) {
    messagesForModel.push(...exampleMessages);
  }
  if (recentMessages && recentMessages.length > 0) {
    for (const m of recentMessages) {
      messagesForModel.push({
        role: m.role === 'character' ? 'assistant' :
              m.role === 'user' ? 'user' : 'system',
        content: m.content
      });
    }
  }
  messagesForModel.push({ role: 'user', content: message });

  // 4-3) 최근 대화가 20개 이상 쌓이면 요약 레코드를 갱신해 장기 문맥을 보존한다
  if (recentMessages && recentMessages.length >= 20) {
    try {
      const summaryPrompt = `다음은 캐릭터와 사용자의 최근 대화 기록입니다. 캐릭터의 성격, 감정 변화, 관계, 다음 대화에서 계속 참고해야 할 사실을 3~4문장으로 요약해 주세요.\n${recentMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')}`;
      const summaryRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 캐릭터 대화 내용을 정확하게 요약하는 어시스턴트입니다.' },
          { role: 'user', content: summaryPrompt }
        ],
        max_tokens: 256,
        temperature: 0.5,
      });
      const newSummary = summaryRes.choices[0]?.message?.content?.trim() ?? '';
      if (newSummary) {
        const latestSummary = summaryData?.[0];
        const existingSessionId = latestSummary?.metadata?.session_id;
        if (latestSummary && existingSessionId === sessionId) {
          await supabase
            .from('character_summaries')
            .update({
              summary: newSummary,
              metadata: { session_id: sessionId, user_id: user.id },
              updated_at: new Date().toISOString()
            })
            .eq('id', latestSummary.id);
        } else {
          await supabase.from('character_summaries').insert({
            character_id: id,
            summary: newSummary,
            metadata: { session_id: sessionId, user_id: user.id }
          });
        }
      }
    } catch (e) {
      console.error('summary 생성 오류:', e);
    }
  }

  // 5) OpenAI ?몄텧
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesForModel,
      max_tokens: modeUsage.maxTokens,
      temperature: 0.8,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'LLM ?몄텧 ?ㅽ뙣' });
  }

  const replyText = completion.choices[0]?.message?.content?.trim() ?? '';
  let finalReplyText = replyText;
  let matchedSceneTemplate = null;
  if (sceneModeAllowed && sceneTemplates.length) {
    const extraction = extractSceneRequest(replyText);
    finalReplyText = extraction.cleaned || replyText;
    if (extraction.sceneKey) {
      matchedSceneTemplate = matchSceneTemplate(sceneTemplates, extraction.sceneKey);
    }
    finalReplyText = formatSceneModeReply(finalReplyText);
  }
  const usage = completion.usage ?? {};
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);
  const promptCostWon = (inputTokens / 1000) * OPENAI_PROMPT_COST_PER_1K_WON;
  const completionCostWon = (outputTokens / 1000) * OPENAI_COMPLETION_COST_PER_1K_WON;
  const rawTokenCostWon = (promptCostWon + completionCostWon) * TOKEN_COST_MARGIN;
  const tokenBasedCreditCost = Math.max(1, Math.ceil(rawTokenCostWon || RESERVED_CREDIT_PER_MESSAGE));
  const sceneCreditCost = matchedSceneTemplate ? SCENE_IMAGE_CREDIT_COST : 0;
  let totalCreditCost = tokenBasedCreditCost + sceneCreditCost;
  if (totalCreditCost > currentBalance) {
    console.warn('[character chat] token billing exceeded balance', {
      characterId: id,
      userId: user.id,
      totalCreditCost,
      balance: currentBalance
    });
    totalCreditCost = currentBalance;
  }
  const newBalance = currentBalance - totalCreditCost;
  console.log('[character chat] billing summary', {
    characterId: id,
    userId: user.id,
    inputTokens,
    outputTokens,
    tokenCost: tokenBasedCreditCost,
    sceneCost: sceneCreditCost,
    totalCreditCost,
    balanceAfter: newBalance
  });

  const txPayload = {
    user_id: user.id,
    subscription_id: null,
    tx_type: CREDIT_TX_TYPE_SPEND,
    service_code: 'CHARACTER',
    amount: -totalCreditCost,
    balance_after: newBalance,
    description: `character chat ${id}`,
    metadata: { characterId: id, sessionId }
  };
  if (CREDIT_CATEGORY_CHAT) txPayload.category = CREDIT_CATEGORY_CHAT;

  const { error: txError } = await creditDb
    .from('credit_transactions')
    .insert(txPayload);

  if (txError) {
    console.error('character chat txError', txError);
    return res.status(500).json({ error: 'tx_error' });
  }

  const { error: walletUpdateErr } = await creditDb
    .from('credit_wallets')
    .upsert({
      user_id: user.id,
      balance: newBalance,
      lifetime_used: (wallet?.lifetime_used ?? 0) + totalCreditCost,
      updated_at: new Date().toISOString()
    });

  if (walletUpdateErr) {
    console.error('character chat wallet update error', walletUpdateErr);
    return res.status(500).json({ error: 'wallet_update_error' });
  }

  // 6) ???濡쒓렇瑜???踰덉쓽 insert濡???ν븯???몄텧 ???덇컧
  const insertedAt = new Date();
  const userCreatedAt = insertedAt.toISOString();
  const characterCreatedAt = new Date(insertedAt.getTime() + 1).toISOString();

  const sceneImagePayload = matchedSceneTemplate
    ? {
        label: matchedSceneTemplate.label,
        image_url: matchedSceneTemplate.image_url,
        emotion_key: matchedSceneTemplate.emotion_key || slugifyKey(matchedSceneTemplate.label),
      }
    : null;

  const chatRows = [
    {
      character_id: id,
      user_id: user.id ?? null,
      session_id: sessionId,
      role: 'user',
      content: message,
      created_at: userCreatedAt
    },
    {
      character_id: id,
      user_id: user.id ?? null,
      session_id: sessionId,
      role: 'character',
      content: finalReplyText,
      model: 'gpt-4o-mini',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      credit_spent: totalCreditCost,
      metadata: {
        ...usage,
        scene_image: sceneImagePayload,
        chat_mode: {
          key: selectedModeConfig?.key || 'default',
          multiplier: modeUsage.multiplier,
          max_tokens: modeUsage.maxTokens,
          credit_cost_reserved: RESERVED_CREDIT_PER_MESSAGE,
          scene_mode: modeSceneFlag
        },
        billing: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
          prompt_cost_won: Number(promptCostWon.toFixed(6)),
          completion_cost_won: Number(completionCostWon.toFixed(6)),
          margin: TOKEN_COST_MARGIN,
          token_credit_cost: tokenBasedCreditCost,
          scene_credit_cost: sceneCreditCost
        }
      },
      created_at: characterCreatedAt
    }
  ];

  const { data: insertedChats, error: insertChatErr } = await creditDb
    .from('character_chats')
    .insert(chatRows)
    .select('id, character_id, session_id, role, content, created_at, user_id, model, input_tokens, output_tokens, credit_spent, metadata');

  if (insertChatErr) {
    return res.status(500).json({ error: insertChatErr.message });
  }

  const insertedUserMsg = insertedChats.find((m) => m.role === 'user');
  const insertedCharMsg = insertedChats.find((m) => m.role === 'character');

  // 6-1) ?ㅻ옒?????蹂댁〈 ?뺤콉 (湲곕낯 90?? - 鍮꾨룞湲?
  const RETENTION_DAYS = 90;
  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  supabase
    .from('character_chats')
    .delete()
    .lt('created_at', retentionCutoff)
    .eq('character_id', id)
    .then(({ error }) => {
      if (error) console.error('character chat retention cleanup error', error);
    });

  // 7) ?묐떟
  const responseCharacterMessage = insertedCharMsg
    ? { ...insertedCharMsg, sceneImage: sceneImagePayload }
    : null;

  res.json({
    userMessage: insertedUserMsg,
    characterMessage: responseCharacterMessage,
    sceneImageUsed: Boolean(sceneImagePayload),
    sceneModeApplied: sceneModeAllowed,
    sceneModeDeniedReason,
    credit: {
      spent: totalCreditCost,
      balance: newBalance,
      tokenCost: tokenBasedCreditCost,
      sceneCost: sceneCreditCost
    },
    chatMode: {
      key: selectedModeConfig?.key || 'default',
      name: selectedModeConfig?.name || '기본 모드',
      multiplier: modeUsage.multiplier,
      maxTokens: modeUsage.maxTokens,
      reservedCreditCost: RESERVED_CREDIT_PER_MESSAGE,
      sceneExtraCost: sceneCreditCost,
      sceneMode: modeSceneFlag,
      tokenCreditCost: tokenBasedCreditCost
    }
  });
});

// Server will be started at the end of the file (single consolidated startup block)







// ?곹뭹/?뚮옖 ?ㅼ젙 ?대젮二쇰뒗 API
app.get('/api/credit-config', async (req, res) => {
  try {
    // Default response so the UI can still render even if Supabase is unreachable
    const fallbackPayload = {
      success: true,
      plans: [],
      adReward: CREDIT_SYSTEM.adReward,
      dailyWelcome: CREDIT_SYSTEM.dailyWelcome,
      paddleVendorId: process.env.PADDLE_VENDOR_ID || null,
      paddleSellerId: (process.env.PADDLE_SELLER_ID || null) || undefined,
      paddleClientToken:
        process.env.PADDLE_CLIENT_TOKEN ||
        process.env.PADDLE_CHECKOUT_TOKEN ||
        null,
      paddleEnv:
        process.env.PADDLE_ENV ||
        (process.env.PADDLE_SANDBOX === 'true' ? 'sandbox' : undefined)
    };

    const { data, error } = await supabase
      .from('plans')
      .select('id, code, name, description, price_cents, features')
      .eq('is_active', true);

    if (error) {
      // Supabase occasionally returns an HTML body (e.g., Cloudflare 522); log briefly and serve fallback
      const errMsg = typeof error?.message === 'string'
        ? error.message.slice(0, 120)
        : String(error).slice(0, 120);
      if (Date.now() - lastCreditConfigLog > CREDIT_CONFIG_LOG_COOLDOWN_MS) {
        console.error('credit-config error (serving fallback)', errMsg);
        lastCreditConfigLog = Date.now();
      }
      return res.status(200).json(fallbackPayload);
    }

    const paddleEnv =
      process.env.PADDLE_ENV ||
      (process.env.PADDLE_SANDBOX === 'true' ? 'sandbox' : null);
    const paddleClientToken =
      process.env.PADDLE_CLIENT_TOKEN ||
      process.env.PADDLE_CHECKOUT_TOKEN ||
      null;
    const paddleSellerId = process.env.PADDLE_SELLER_ID || null;

    return res.json({
      success: true,
      plans: data || [],
      adReward: CREDIT_SYSTEM.adReward,
      dailyWelcome: CREDIT_SYSTEM.dailyWelcome,
      paddleVendorId: process.env.PADDLE_VENDOR_ID || null,
      paddleSellerId: paddleSellerId || undefined,
      paddleClientToken: paddleClientToken || null,
      paddleEnv: paddleEnv || undefined
    });
  } catch (e) {
    // If Supabase or network throws (e.g., timeout), respond with safe fallback
    const errMsg = typeof e?.message === 'string' ? e.message.slice(0, 120) : String(e).slice(0, 120);
    if (Date.now() - lastCreditConfigLog > CREDIT_CONFIG_LOG_COOLDOWN_MS) {
      console.error('credit-config exception (serving fallback)', errMsg);
      lastCreditConfigLog = Date.now();
    }
    return res.status(200).json({
      success: true,
      plans: [],
      adReward: CREDIT_SYSTEM.adReward,
      dailyWelcome: CREDIT_SYSTEM.dailyWelcome,
      paddleVendorId: process.env.PADDLE_VENDOR_ID || null,
      paddleSellerId: process.env.PADDLE_SELLER_ID || undefined,
      paddleClientToken:
        process.env.PADDLE_CLIENT_TOKEN ||
        process.env.PADDLE_CHECKOUT_TOKEN ||
        null,
      paddleEnv:
        process.env.PADDLE_ENV ||
        (process.env.PADDLE_SANDBOX === 'true' ? 'sandbox' : undefined)
    });
  }
});

// ad-session ?앹꽦: 蹂댁긽??愿묎퀬瑜??쒖옉?섍린 ???쒕쾭?먯꽌 ?몄뀡???앹꽦?⑸땲??
// - ?대씪?댁뼵?몃뒗 /api/ad-session???몄텧??sessionId瑜?諛쏄퀬,
//   ??sessionId瑜?愿묎퀬 ?쒓렇??cust_params???ы븿?쒖폒 愿묎퀬 ?붿껌/由ы룷?낆뿉 ?곌껐?⑸땲??
// - 愿묎퀬 ?꾨즺 ???대씪?댁뼵?몃뒗 /api/earn-credits濡?sessionId瑜??쒖텧?섍퀬 ?쒕쾭??session??寃利앺븳 ??吏湲됲빀?덈떎.
app.post('/api/ad-session', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ success: false, error: 'unauthorized' });

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const { error } = await supabase.from('ad_sessions').insert([{
      id: sessionId,
      user_id: user.id,
      ad_network: 'GAM',
      created_at: now.toISOString(),
      expires_at: expiresAt,
      used: false
    }]);

    if (error) {
      console.error('ad-session insert error', error);
      return res.status(500).json({ success: false, error: 'db_error' });
    }

    return res.json({ success: true, sessionId, expiresAt });
  } catch (e) {
    console.error('ad-session exception', e);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 愿묎퀬 蹂닿린濡??щ젅???산린
app.post('/api/earn-credits', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const userId = user.id;

    // If the client provided a sessionId (created by /api/ad-session), validate it.
    const { sessionId, verification } = req.body || {};
    let adNetworkForTx = 'web_reward';

    // today 0??check (moved down)
    // If sessionId exists, verify session record
    if (sessionId) {
      try {
        const { data: sessionRows, error: sessionError } = await supabase
          .from('ad_sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionError) {
          console.error('ad-session lookup error', sessionError);
          return res.status(500).json({ success: false, error: 'session_lookup_error' });
        }

        if (!sessionRows) {
          return res.status(400).json({ success: false, error: 'invalid_session', message: 'Ad session not found' });
        }

        if (sessionRows.user_id !== userId) {
          return res.status(403).json({ success: false, error: 'invalid_session_owner' });
        }

        if (sessionRows.used) {
          return res.status(400).json({ success: false, error: 'session_used' });
        }

        const now = new Date();
        if (sessionRows.expires_at && new Date(sessionRows.expires_at) < now) {
          return res.status(400).json({ success: false, error: 'session_expired' });
        }

        // set ad network for this session so transactions record source
        adNetworkForTx = sessionRows.ad_network || 'web_reward';

        // Optional: validate verification payload with ad network here
        // For GAM/IMA you might map session id to reporting data or call network APIs.
        // We'll treat the session as valid at this point (production should verify with network tokens if available).

        // mark session used atomically
        const { error: markError } = await supabase
          .from('ad_sessions')
          .update({ used: true, used_at: new Date().toISOString(), verification: verification || null })
          .eq('id', sessionId);

        if (markError) {
          console.error('ad-session mark used error', markError);
          return res.status(500).json({ success: false, error: 'session_update_error' });
        }
      } catch (e) {
        console.error('ad-session validation exception', e);
        return res.status(500).json({ success: false, error: 'session_exception' });
      }
    }

    // ?ㅻ뒛 0??~ 吏湲?
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayRewards, error: rewardsError } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('category', 'ad_reward')   // enum/????대쫫??留욊쾶 ?꾩슂 ???섏젙
      .gte('occurred_at', todayStart.toISOString());

    if (rewardsError) {
      console.error('earn-credits rewardsError', rewardsError);
      return res.status(500).json({ success: false, error: 'db_error' });
    }

    const usedCount = todayRewards?.length || 0;
    if (usedCount >= CREDIT_SYSTEM.adReward.maxPerDay) {
      return res.json({
        success: false,
        error: 'limit_reached',
        message: '?ㅻ뒛? ???댁긽 愿묎퀬 蹂댁긽??諛쏆쓣 ???놁뒿?덈떎.'
      });
    }

    // ?꾩옱 wallet 議고쉶
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('balance, lifetime_used')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) {
      console.error('earn-credits walletError', walletError);
      return res.status(500).json({ success: false, error: 'wallet_error' });
    }

    const currentBalance = wallet?.balance ?? 0;
    const add = CREDIT_SYSTEM.adReward.credits;
    const newBalance = currentBalance + add;

    // ?몃옖??뀡 湲곕줉
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        subscription_id: null,
        tx_type: 'earn',              // ?ㅼ젣 enum 媛믪뿉 留욊쾶 ?꾩슂 ???섏젙
        category: 'ad_reward',        // ?ㅼ젣 ??낆뿉 留욊쾶 ?꾩슂 ???섏젙
        service_code: 'GLOBAL',
        amount: add,
        balance_after: newBalance,
        description: `${adNetworkForTx} rewarded ad`,
        metadata: { source: adNetworkForTx, verification: verification || null }
      });

    if (txError) {
      console.error('earn-credits txError', txError);
      return res.status(500).json({ success: false, error: 'tx_error' });
    }

    // wallet upsert
    const { error: upsertError } = await supabase
      .from('credit_wallets')
      .upsert({
        user_id: userId,
        balance: newBalance,
        lifetime_used: wallet?.lifetime_used ?? 0,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('earn-credits upsertError', upsertError);
      return res.status(500).json({ success: false, error: 'wallet_update_error' });
    }

    return res.json({
      success: true,
      earned: add,
      balance: newBalance,
      usedToday: usedCount + 1,
      maxPerDay: CREDIT_SYSTEM.adReward.maxPerDay
    });
  } catch (e) {
    console.error('earn-credits exception', e);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});


// ?뚮옖 援щℓ ?쒖옉 (援щ룆沅??щ젅????怨듯넻)
// 援щℓ(援щ룆) ?쒖옉: Paddle ?곕룞 吏??
// - planCode 瑜?諛쏆븘 plans ?뚯씠釉붿뿉???곹뭹 ?뺣낫瑜?李얠뒿?덈떎.
// - plans.features.paddle_product_id ?먮뒗 plans.features.paddle_link 議댁옱 ??Paddle 寃곗젣 留곹겕瑜??앹꽦?댁꽌 諛섑솚?⑸땲??
// - PADDLE_VENDOR_ID / PADDLE_VENDOR_AUTH_CODE ??.env ???ㅼ젙?댁꽌 ?ъ슜?섏꽭??(?덈? 肄붾뱶???ㅻ? ?섎뱶肄붾뵫?섏? 留덉꽭??.
app.post('/api/buy-plan', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const { planCode } = req.body;

    console.log('buy-plan request', user.id, planCode);

    // 1) plan 議고쉶
    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('code', planCode)
      .maybeSingle();

    if (planError) {
      console.error('buy-plan plan lookup error', planError);
      return res.status(500).json({ success: false, error: 'plan_lookup_error' });
    }

    if (!planData) {
      return res.status(404).json({ success: false, error: 'plan_not_found' });
    }

    // ?덈줈 異붽?: Paddle ?곕룞 (?섍꼍蹂?섏뿉 PADDLE_VENDOR_* ?ㅼ젙?섏뼱 ?덉뼱????
    const PADDLE_VENDOR_ID = process.env.PADDLE_VENDOR_ID;
    const PADDLE_VENDOR_AUTH_CODE = process.env.PADDLE_VENDOR_AUTH_CODE;

    // 怨꾪쉷(features) ?대??먯꽌 paddle 愿???뺣낫瑜?李얠뒿?덈떎.
    // 異붿쿇: plans.features JSON??paddle_product_id ?먮뒗 paddle_link 瑜???ν븯?몄슂.
    const features = planData.features || {};
    const paddleProductId = features.paddle_product_id || null;
    const paddleLink = features.paddle_link || null;

    // If a paddle_link exists on the plan, return it directly
    if (paddleLink) {
      return res.json({ success: true, checkoutUrl: paddleLink });
    }

    // If Paddle is configured and product id present, call Paddle API to generate a pay link
    if (PADDLE_VENDOR_ID && PADDLE_VENDOR_AUTH_CODE && paddleProductId) {
      try {
        // Paddle API: generate_pay_link
        // Docs: https://developer.paddle.com/api-reference/0c52d5a975c4a-generate-pay-link
        const body = new URLSearchParams();
        body.append('vendor_id', PADDLE_VENDOR_ID);
        body.append('vendor_auth_code', PADDLE_VENDOR_AUTH_CODE);
        body.append('product_id', String(paddleProductId));
        // optional: passthrough can include planCode/user info for later verification
        body.append('passthrough', JSON.stringify({ planCode, userId: user.id }));

        const paddleRes = await fetch('https://vendors.paddle.com/api/2.0/product/generate_pay_link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });

        const paddleJson = await paddleRes.json();
        if (!paddleJson || !paddleJson.success) {
          console.error('paddle generate_pay_link failed', paddleJson);
          // fallback: return stub checkoutUrl
          return res.json({ success: false, error: 'paddle_link_error', details: paddleJson });
        }

        // paddleJson.response.url usually contains the hosted checkout URL
        const checkoutUrl = paddleJson.response && paddleJson.response.url;
        if (!checkoutUrl) {
          return res.json({ success: false, error: 'no_checkout_url' });
        }

        return res.json({ success: true, checkoutUrl });
      } catch (e) {
        console.error('paddle generate_pay_link exception', e);
        return res.status(500).json({ success: false, error: 'paddle_exception' });
      }
    }

    // Fallback: if a client token + price id env is provided, return that so the frontend can open the checkout
    const paddleClientToken =
      process.env.PADDLE_CLIENT_TOKEN ||
      process.env.PADDLE_CHECKOUT_TOKEN ||
      null;
    const paddleSellerId = process.env.PADDLE_SELLER_ID || null;
    const paddleEnv =
      process.env.PADDLE_ENV ||
      (process.env.PADDLE_SANDBOX === 'true' ? 'sandbox' : null);

    if (paddleClientToken) {
      const envKey = `PADDLE_PRICE_ID_${(planCode || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')}`;
      const fallbackPriceId =
        process.env[envKey] || process.env.PADDLE_PRICE_ID_DEFAULT || null;

      if (fallbackPriceId) {
        return res.json({
          success: true,
          paddle: {
            priceId: fallbackPriceId,
            clientToken: paddleClientToken,
            environment: paddleEnv || undefined,
            sellerId: paddleSellerId || undefined
          }
        });
      }
    }

    // TODO: implement other payment providers if needed

    // No paddle info / config ??fallback
    return res.json({ success: true, checkoutUrl: '/coming-soon' });
  } catch (e) {
    console.error('buy-plan exception', e);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});





async function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer().unref();
    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        return resolve(false);
      }
      return reject(err);
    });
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(preferredPort, maxOffset = PORT_FALLBACK_ATTEMPTS) {
  for (let offset = 0; offset <= maxOffset; offset++) {
    const candidate = preferredPort + offset;
    const available = await isPortAvailable(candidate);
    if (available) {
      return { port: candidate, fallbackOffset: offset };
    }
  }
  throw new Error(
    `No available port found from ${preferredPort} to ${preferredPort + maxOffset}`
  );
}

// ===============================
// Server bootstrap
// ===============================
const CERT_KEY_PATH = process.env.CERT_KEY_PATH || './certs/localhost-key.pem';
const CERT_PEM_PATH = process.env.CERT_PEM_PATH || './certs/localhost.pem';
function parseBool(value) {
  if (value == null) return null;
  return String(value).toLowerCase().trim() === 'true';
}
const defaultEnableHttps = APP_ENV === 'local' || APP_ENV === 'development';
const parsedHttpsFlag =
  parseBool(process.env.ENABLE_HTTPS) ?? parseBool(process.env.ENABLE_LOCAL_HTTPS);
const ENABLE_HTTPS = typeof parsedHttpsFlag === 'boolean' ? parsedHttpsFlag : defaultEnableHttps;

async function startServer() {
  try {
    const host = process.env.HOST || '0.0.0.0';
    const { port, fallbackOffset } = await findAvailablePort(
      DEFAULT_PORT,
      PORT_FALLBACK_ATTEMPTS
    );
    if (fallbackOffset > 0) {
      console.warn(
        `Port ${DEFAULT_PORT} is unavailable. Using ${port} instead (offset +${fallbackOffset}).`
      );
    }

    if (ENABLE_HTTPS && fs.existsSync(CERT_KEY_PATH) && fs.existsSync(CERT_PEM_PATH)) {
      try {
        const key = fs.readFileSync(CERT_KEY_PATH);
        const cert = fs.readFileSync(CERT_PEM_PATH);
        https.createServer({ key, cert }, app).listen(port, host, () => {
          console.log(`HTTPS server running on https://${host}:${port}`);
        });
        return;
      } catch (e) {
        console.error('Failed to start HTTPS server, falling back to HTTP', e);
      }
    }

    app.listen(port, host, () => {
      console.log(`HTTP server running on http://${host}:${port}`);
    });
  } catch (err) {
    console.error('Failed to bind server port', err);
    process.exit(1);
  }
}

startServer();
