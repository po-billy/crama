import dotenv from "dotenv";
import Imap from "node-imap";
import { simpleParser } from "mailparser";
import mysql from "mysql2/promise";
import crypto from "crypto";

dotenv.config();

function extractField(lines, ...keys) {
  for (const key of keys) {
    const line = lines.find((entry) => entry.toLowerCase().startsWith(key.toLowerCase()));
    if (line) {
      const [, ...rest] = line.split(":");
      if (rest.length) return rest.join(":").trim();
    }
  }
  return "-";
}

function extractLink(lines, platform) {
  const line = lines.find((entry) => entry.toLowerCase().includes(platform.toLowerCase()));
  if (!line) return "-";
  const [, value] = line.split(":");
  return value?.trim() || "-";
}

function hashData(data) {
  return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
}

async function saveToDb(table, data) {
  const requiredDbVars = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
  ];
  const missingDbVars = requiredDbVars.filter((key) => !process.env[key]);
  if (missingDbVars.length) {
    throw new Error(`Missing database env vars: ${missingDbVars.join(", ")}`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const hash = hashData(data);
    const [rows] = await connection.execute(
      `SELECT id FROM ${table} WHERE hash = ? LIMIT 1`,
      [hash]
    );
    if (rows.length) {
      console.log(`⚠️  Duplicate detected for ${data.name} – skipping insert`);
      return;
    }

    if (table === "submit_business") {
      await connection.execute(
        "INSERT INTO submit_business (name, company, phone, email, message, hash) VALUES (?, ?, ?, ?, ?, ?)",
        [data.name, data.company, data.phone, data.email, data.message, hash]
      );
      console.log(`✅ Saved business inquiry: ${data.name}`);
    } else if (table === "submit_creator") {
      await connection.execute(
        "INSERT INTO submit_creator (name, youtube, instagram, tiktok, phone, email, message, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          data.name,
          data.youtube,
          data.instagram,
          data.tiktok,
          data.phone,
          data.email,
          data.message,
          hash,
        ]
      );
      console.log(`✅ Saved creator inquiry: ${data.name}`);
    }
  } finally {
    await connection.end();
  }
}

function createImapClient() {
  const missing = ["IMAP_USER", "IMAP_PASS", "IMAP_HOST", "IMAP_PORT"].filter(
    (key) => !process.env[key]
  );
  if (missing.length) {
    throw new Error(`Missing IMAP env vars: ${missing.join(", ")}`);
  }
  return new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT),
    tls: true,
  });
}

function openInbox(imap) {
  return new Promise((resolve, reject) => {
    imap.openBox("INBOX", false, (err, box) => {
      if (err) return reject(err);
      return resolve(box);
    });
  });
}

async function handleMessage(parsed) {
  const subject = parsed.subject || "";
  const message = (parsed.text || parsed.html || "본문 없음").trim();
  const lines = message.split("\n").map((line) => line.trim());

  if (subject.includes("🏢[비즈니스 문의]")) {
    const name = extractField(lines, "성함", "이름", "name");
    const data = {
      name,
      company: extractField(lines, "회사명"),
      phone: extractField(lines, "연락처"),
      email:
        extractField(lines, "이메일") ||
        parsed.from?.value?.[0]?.address ||
        "unknown@email.com",
      message,
    };
    await saveToDb("submit_business", data);
  }

  if (subject.includes("🧑‍🎤[크리에이터 문의]")) {
    const name = extractField(lines, "성함", "이름", "name");
    const data = {
      name,
      youtube: extractLink(lines, "YouTube"),
      instagram: extractLink(lines, "Instagram"),
      tiktok: extractLink(lines, "TikTok"),
      phone: extractField(lines, "연락처"),
      email:
        extractField(lines, "이메일") ||
        parsed.from?.value?.[0]?.address ||
        "unknown@email.com",
      message,
    };
    await saveToDb("submit_creator", data);
  }
}

async function run() {
  const imap = createImapClient();

  imap.once("ready", async () => {
    try {
      await openInbox(imap);
      const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      imap.search(["ALL", ["SINCE", sinceDate]], (err, results = []) => {
        if (err) throw err;
        if (!results.length) {
          console.log("📭 새 메일 없음.");
          imap.end();
          return;
        }
        const fetcher = imap.fetch(results, { bodies: "" });
        fetcher.on("message", (msg) => {
          msg.on("body", (stream) => {
            simpleParser(stream, async (parseErr, parsed) => {
              if (parseErr) {
                console.error("❌ 파싱 오류:", parseErr);
                return;
              }
              try {
                await handleMessage(parsed);
              } catch (handlerErr) {
                console.error("❌ 저장 실패:", handlerErr);
              }
            });
          });
        });
        fetcher.once("end", () => {
          console.log("📬 메일 처리 완료");
          imap.end();
        });
      });
    } catch (error) {
      console.error("❌ IMAP 처리 오류:", error);
      imap.end();
    }
  });

  imap.once("error", (err) => {
    console.error("❌ IMAP 오류:", err);
  });

  imap.once("end", () => {
    console.log("📡 연결 종료됨");
  });

  imap.connect();
}

run().catch((error) => {
  console.error("IMAP sync failed:", error);
  process.exit(1);
});
