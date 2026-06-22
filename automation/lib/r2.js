// Cloudflare R2(S3 호환) 업로드 헬퍼 — 이미지/오디오 공용.
// 필요한 env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (+ 버킷/공개 URL)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE } = process.env;

export function r2Configured() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

let _client;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return _client;
}

// 객체 업로드 후 공개 URL 반환. bucket/publicBase 를 넘기면 우선 사용(오디오 전용 버킷 등).
export async function putObject({ key, body, contentType, bucket, publicBase, cache = true }) {
  if (!r2Configured()) throw new Error('R2 환경변수가 없습니다(.env 의 R2_* 확인).');
  const Bucket = bucket || R2_BUCKET;
  if (!Bucket) throw new Error('R2 버킷명이 없습니다(R2_BUCKET 또는 인자 bucket).');
  await client().send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(cache ? { CacheControl: 'public, max-age=31536000, immutable' } : {}),
    }),
  );
  const base = (publicBase || R2_PUBLIC_BASE || '').replace(/\/$/, '');
  return base ? `${base}/${key}` : key;
}
