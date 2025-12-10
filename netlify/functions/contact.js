const nodemailer = require("nodemailer");

const CONTACT_MAIL_FROM = process.env.CONTACT_MAIL_FROM || "help@crama.app";
const CONTACT_MAIL_TO = process.env.CONTACT_MAIL_TO || CONTACT_MAIL_FROM;
const CONTACT_MAIL_BCC = parseAddressList(process.env.CONTACT_MAIL_BCC || "");
const CONTACT_MAIL_SUBJECT_PREFIX =
  process.env.CONTACT_MAIL_SUBJECT_PREFIX || "[Crama 문의]";
const CONTACT_GMAIL_USER = process.env.CONTACT_GMAIL_USER || "";
const CONTACT_GMAIL_PASS = process.env.CONTACT_GMAIL_PASS || "";
const CONTACT_SMTP_HOST = process.env.CONTACT_SMTP_HOST || "";
const CONTACT_SMTP_PORT = parseInt(process.env.CONTACT_SMTP_PORT || "587", 10);
const CONTACT_SMTP_SECURE = String(
  process.env.CONTACT_SMTP_SECURE ??
    (CONTACT_SMTP_PORT === 465 ? "true" : "false")
)
  .toLowerCase()
  .trim() === "true";
const CONTACT_SMTP_USER = process.env.CONTACT_SMTP_USER || "";
const CONTACT_SMTP_PASS = process.env.CONTACT_SMTP_PASS || "";

const CONTACT_CATEGORY_LABELS = {
  general: "일반 문의",
  billing: "결제/scene",
  bug: "버그 신고",
  partnership: "제휴/협업",
  other: "기타",
};
const CONTACT_MAX_MESSAGE_LENGTH = 2000;

function parseAddressList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  return CONTACT_CATEGORY_LABELS[key] ? key : "general";
}

function createTransport() {
  if (CONTACT_GMAIL_USER && CONTACT_GMAIL_PASS) {
    return nodemailer.createTransport({
      service: "Gmail",
      auth: { user: CONTACT_GMAIL_USER, pass: CONTACT_GMAIL_PASS },
    });
  }
  if (CONTACT_SMTP_HOST && CONTACT_SMTP_USER && CONTACT_SMTP_PASS) {
    return nodemailer.createTransport({
      host: CONTACT_SMTP_HOST,
      port: CONTACT_SMTP_PORT,
      secure: CONTACT_SMTP_SECURE,
      auth: { user: CONTACT_SMTP_USER, pass: CONTACT_SMTP_PASS },
    });
  }
  return null;
}

const mailer = createTransport();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ message: "method_not_allowed" }) };
  }
  if (!mailer) {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: "contact_disabled" }),
    };
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ message: "invalid_json" }) };
  }

  const name = sanitizeLine(payload.name, 80);
  const email = sanitizeLine(payload.email, 120);
  const categoryKey = resolveContactCategory(payload.category);
  const categoryLabel = CONTACT_CATEGORY_LABELS[categoryKey];
  const message = sanitizeMultiline(payload.message, CONTACT_MAX_MESSAGE_LENGTH);
  const page = sanitizeLine(payload.page || payload.pageUrl || event.headers.referer, 200);

  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ message: "missing_fields" }) };
  }
  if (!isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ message: "invalid_email" }) };
  }

  const toList = parseAddressList(CONTACT_MAIL_TO);
  if (!toList.length) {
    return { statusCode: 500, body: JSON.stringify({ message: "contact_recipient_missing" }) };
  }

  const clientIp =
    event.headers["x-forwarded-for"] ||
    event.headers["client-ip"] ||
    event.ip ||
    "";
  const userAgent = sanitizeLine(event.headers["user-agent"], 200);
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

  try {
    await mailer.sendMail({
      from: CONTACT_MAIL_FROM,
      to: toList,
      bcc: CONTACT_MAIL_BCC.length ? CONTACT_MAIL_BCC : undefined,
      replyTo: email,
      subject: `${CONTACT_MAIL_SUBJECT_PREFIX} ${categoryLabel} - ${name}`,
      text: textBody,
      html: htmlBody,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("contact function send error", error);
    return {
      statusCode: 502,
      body: JSON.stringify({ message: "contact_send_failed" }),
    };
  }
};
