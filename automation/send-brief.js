// 배포 라이브 확인 후 호출 — last-brief.json(제목/URL) 읽어 구독자에게 Web Push 발송.
//   사용: node send-brief.js   (publish.yml 의 deploy-후 단계에서 실행)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendBrief } from './lib/push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let brief;
try {
  brief = JSON.parse(await fs.readFile(path.join(__dirname, 'last-brief.json'), 'utf8'));
} catch (e) {
  console.log('브리핑 정보(last-brief.json) 없음 — 스킵');
  process.exit(0);
}
const r = await sendBrief(brief);
console.log('푸시 발송 결과:', JSON.stringify(r));
