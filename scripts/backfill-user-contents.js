#!/usr/bin/env node

/**
 * Backfill user_contents rows from generate_image_character storage objects.
 *
 * Required env:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *  - PUBLIC_SUPABASE_URL         (used for public storage URLs)
 *  - STORAGE_BUCKET_NAME         (defaults to generate_image_character)
 *  - SERVICE_CODE_STUDIO         (defaults to CRAMA_STUDIO)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function expandEnv(value, depth = 5) {
  if (typeof value !== 'string' || !value.includes('${')) return value;
  let resolved = value;
  const pattern = /\$\{([^}]+)\}/g;
  for (let i = 0; i < depth && typeof resolved === 'string' && resolved.includes('${'); i++) {
    resolved = resolved.replace(pattern, (match, varName) => process.env[varName] ?? '');
  }
  return resolved;
}

const SUPABASE_URL = expandEnv(process.env.SUPABASE_URL);
const SERVICE_KEY = expandEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_SUPABASE_URL = (expandEnv(process.env.PUBLIC_SUPABASE_URL) || SUPABASE_URL || '').replace(
  /\/+$/,
  ''
);
const STORAGE_BUCKET = expandEnv(process.env.STORAGE_BUCKET_NAME) || 'generate_image_character';
const SERVICE_CODE_STUDIO = expandEnv(process.env.SERVICE_CODE_STUDIO) || 'CRAMA_STUDIO';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const storageClient = supabase.storage.from(STORAGE_BUCKET);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function listFolder(path = '', limit = 1000) {
  const items = [];
  let offset = 0;
  while (true) {
    const { data, error } = await storageClient.list(path, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || !data.length) break;
    items.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return items;
}

async function recordExists(userId, fullUrl) {
  const { data, error } = await supabase
    .from('user_contents')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'image')
    .eq('full_url', fullUrl)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

function toPublicUrl(path) {
  const normalized = path.replace(/^\/+/, '');
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${normalized}`;
}

function buildTitle(fileName, prompt) {
  if (prompt) {
    const trimmed = prompt.trim();
    if (trimmed.length <= 40) return trimmed;
    return `${trimmed.slice(0, 37)}...`;
  }
  if (fileName && fileName.length <= 40) return fileName;
  return (fileName || 'generated-image').slice(0, 40);
}

async function processUserFolder(userId) {
  const files = await listFolder(userId);
  if (!files.length) return [];
  const rows = [];
  for (const file of files) {
    if (!file.name) continue;
    const path = `${userId}/${file.name}`;
    const publicUrl = toPublicUrl(path);
    const exists = await recordExists(userId, publicUrl);
    if (exists) continue;
    rows.push({
      user_id: userId,
      service_code: SERVICE_CODE_STUDIO,
      kind: 'image',
      title: buildTitle(file.name, file.metadata?.prompt || ''),
      prompt: file.metadata?.prompt || null,
      thumb_url: publicUrl,
      full_url: publicUrl,
      created_at: file.created_at || new Date().toISOString(),
      extra: {
        size: file.metadata?.size || file.size || null,
        bucket: STORAGE_BUCKET,
        path,
      },
    });
  }
  return rows;
}

async function insertRows(rows) {
  if (!rows.length) return 0;
  const { error } = await supabase.from('user_contents').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function main() {
  console.log(`[backfill] bucket=${STORAGE_BUCKET}`);
  const rootEntries = await listFolder('');
  const folders = rootEntries
    .filter((entry) => entry && entry.name && isUuid(entry.name) && entry.metadata === null)
    .map((entry) => entry.name);
  console.log(`[backfill] detected ${folders.length} user folders`);

  let totalInserted = 0;
  for (const userId of folders) {
    const rows = await processUserFolder(userId);
    if (!rows.length) continue;
    const inserted = await insertRows(rows);
    totalInserted += inserted;
    console.log(`[backfill] user ${userId} -> inserted ${inserted} rows`);
  }
  console.log(`[backfill] done, inserted ${totalInserted} rows total`);
}

main().catch((err) => {
  console.error('[backfill] fatal error', err);
  process.exit(1);
});
