import { supabaseAdmin } from "@/lib/supabase";
import type { Job, JobType, EnqueueOptions } from "./types";
import { JobStatus as JS } from "./types";

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<Job | null> {
  const { priority = 0, maxRetries = 3, scheduledAt } = options;

  const { data, error } = await supabaseAdmin
    .from("job_queue")
    .insert({
      id: crypto.randomUUID(),
      type,
      payload,
      status: JS.PENDING,
      priority,
      max_retries: maxRetries,
      scheduled_at: (scheduledAt || new Date()).toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error(`[Queue] Enqueue ${type} failed:`, error.message);
    return null;
  }

  console.log(`[Queue] Enqueued ${type} job ${data.id}`);
  return data as unknown as Job;
}

export async function dequeue(types?: JobType[]): Promise<Job | null> {
  let query = supabaseAdmin
    .from("job_queue")
    .update({ status: JS.PROCESSING, started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("status", JS.PENDING)
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (types && types.length > 0) {
    query = query.in("type", types);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error(`[Queue] Dequeue failed:`, error.message);
    return null;
  }

  return data as unknown as Job;
}

export async function complete(jobId: string): Promise<void> {
  await supabaseAdmin
    .from("job_queue")
    .update({
      status: JS.COMPLETED,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function fail(jobId: string, errorMsg: string, retry = true): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from("job_queue")
    .select("retry_count, max_retries")
    .eq("id", jobId)
    .single();

  if (!job) return;

  const retryCount = (job.retry_count || 0) + 1;
  const shouldRetry = retry && retryCount < (job.max_retries || 3);

  if (shouldRetry) {
    const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
    await supabaseAdmin
      .from("job_queue")
      .update({
        status: JS.PENDING,
        retry_count: retryCount,
        last_error: errorMsg,
        scheduled_at: new Date(Date.now() + delayMs).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    console.log(`[Queue] Job ${jobId} will retry in ${delayMs}ms (attempt ${retryCount}/${job.max_retries})`);
  } else {
    await supabaseAdmin
      .from("job_queue")
      .update({
        status: JS.FAILED,
        retry_count: retryCount,
        last_error: errorMsg,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    console.error(`[Queue] Job ${jobId} failed permanently: ${errorMsg}`);
  }
}

export async function processNext(handler: (job: Job) => Promise<boolean>, types?: JobType[]): Promise<boolean> {
  const job = await dequeue(types);
  if (!job) return false;

  try {
    const success = await handler(job);
    if (success) {
      await complete(job.id);
    } else {
      await fail(job.id, "Handler returned false", true);
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await fail(job.id, msg, true);
    return true;
  }
}

export async function processAll(
  handler: (job: Job) => Promise<boolean>,
  types?: JobType[],
  maxJobs = 10
): Promise<number> {
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    const didWork = await processNext(handler, types);
    if (!didWork) break;
    processed++;
  }
  return processed;
}

export async function retryFailed(
  type?: JobType,
  maxRetries?: number
): Promise<number> {
  let query = supabaseAdmin
    .from("job_queue")
    .update({
      status: JS.PENDING,
      retry_count: 0,
      last_error: null,
      scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("status", JS.FAILED);

  if (type) query = query.eq("type", type);
  if (maxRetries !== undefined) query = query.lt("retry_count", maxRetries);

  const { data } = await query.select("id");

  const count = data ? data.length : 0;
  if (count > 0) console.log(`[Queue] Reset ${count} failed jobs for retry`);
  return count;
}

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const { data } = await supabaseAdmin
    .from("job_queue")
    .select("status, count");

  const counts: Record<string, number> = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  if (data) {
    for (const row of data as Array<{ status: string; count: number }>) {
      counts[row.status] = row.count;
    }
  }
  return {
    pending: counts.PENDING,
    processing: counts.PROCESSING,
    completed: counts.COMPLETED,
    failed: counts.FAILED,
  };
}
