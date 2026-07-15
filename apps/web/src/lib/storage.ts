import { createClient } from "@supabase/supabase-js";

const RESUME_BUCKET = "resumes";
let bucketEnsured = false;

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function ensureBucket() {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(RESUME_BUCKET, { public: false });
  // Ignore "already exists" — every other error should surface.
  if (error && !error.message.includes("already exists")) {
    throw error;
  }
  bucketEnsured = true;
}

export async function uploadResumeFile(params: {
  userId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}): Promise<{ path: string }> {
  await ensureBucket();
  const supabase = getSupabaseAdmin();
  const path = `${params.userId}/${crypto.randomUUID()}-${params.fileName}`;

  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(path, params.buffer, { contentType: params.contentType });

  if (error) throw error;
  return { path };
}

export async function getResumeSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, 60 * 10); // 10 minutes

  if (error) throw error;
  return data.signedUrl;
}
