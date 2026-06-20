import { join } from "@std/path";
import { Client } from "@db/postgres";
import { loadConfig } from "../lib/config.ts";
import { normalizeDatabaseUrl } from "../lib/db_url.ts";
import { loadEnvFile } from "../lib/load_env.ts";
import { FileStorageService } from "../lib/repositories/file_storage_service.ts";
import { PostgresRepository } from "../lib/repositories/postgres_repository.ts";
import {
  getDemoSubmissionContent,
  getPendingDemoContent,
} from "../lib/seed/demo_submission_content.ts";
import { generateDemoImage } from "../lib/seed/generate_demo_image.ts";
import { AutoModeratorServiceImpl, SEEDED_DEFAULT_WORD_LIST } from "../lib/services/auto_moderator_service_impl.ts";
import { MODERATOR_USERNAME, runSeed } from "./seed.ts";

export const DEMO_SEED_SOURCE = "demo_seed";
export const DEFAULT_DEMO_SEED_COUNT = 40;
export const DEFAULT_DEMO_PENDING_COUNT = 10;

export interface SeedDemoSubmissionsOptions {
  count?: number;
  pending?: number;
  force?: boolean;
  databaseUrl?: string;
}

export interface SeedDemoSubmissionsResult {
  created: number;
  pendingCreated: number;
  flaggedCreated: number;
  skipped: boolean;
  removed: number;
}

interface DemoSeedRow {
  id: string;
  image_url: string;
}

export function parseSeedDemoArgs(
  args: string[],
): { count: number; pending: number; force: boolean } {
  let count = DEFAULT_DEMO_SEED_COUNT;
  let pending = DEFAULT_DEMO_PENDING_COUNT;
  let force = false;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    const countMatch = arg.match(/^--count=(\d+)$/);
    if (countMatch) {
      count = Math.max(1, Number.parseInt(countMatch[1], 10));
      continue;
    }
    const pendingMatch = arg.match(/^--pending=(\d+)$/);
    if (pendingMatch) {
      pending = Math.max(0, Number.parseInt(pendingMatch[1], 10));
    }
  }

  return { count, pending, force };
}

async function listDemoSeedRows(client: Client): Promise<DemoSeedRow[]> {
  const result = await client.queryObject<DemoSeedRow>(
    `SELECT id, image_url FROM submissions WHERE source = $1 ORDER BY created_at ASC`,
    [DEMO_SEED_SOURCE],
  );
  return result.rows;
}

function imagePathFromUrl(imageUrl: string): string {
  return imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
}

async function removeDemoSeedData(
  client: Client,
  storage: FileStorageService,
  storagePath: string,
): Promise<number> {
  const rows = await listDemoSeedRows(client);
  for (const row of rows) {
    const relative = imagePathFromUrl(row.image_url);
    try {
      await Deno.remove(join(storagePath, relative));
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
  }
  await client.queryArray(`DELETE FROM submissions WHERE source = $1`, [DEMO_SEED_SOURCE]);
  return rows.length;
}

export async function runSeedDemoSubmissions(
  options: SeedDemoSubmissionsOptions = {},
): Promise<SeedDemoSubmissionsResult> {
  loadEnvFile();
  const config = loadConfig();
  const databaseUrl = normalizeDatabaseUrl(options.databaseUrl ?? config.database.url);
  const count = options.count ?? DEFAULT_DEMO_SEED_COUNT;
  const pending = options.pending ?? DEFAULT_DEMO_PENDING_COUNT;
  const force = options.force ?? false;

  await runSeed(databaseUrl);

  const client = new Client(databaseUrl);
  await client.connect();

  const repo = new PostgresRepository(databaseUrl);
  await repo.connect();
  const storage = new FileStorageService(config.storage.path);

  try {
    const existing = await listDemoSeedRows(client);
    if (existing.length > 0 && !force) {
      return { created: 0, pendingCreated: 0, flaggedCreated: 0, skipped: true, removed: 0 };
    }

    let removed = 0;
    if (existing.length > 0 && force) {
      removed = await removeDemoSeedData(client, storage, config.storage.path);
    }

    const moderator = await repo.authenticateUser(MODERATOR_USERNAME);
    if (!moderator) {
      throw new Error(
        `Moderator user '${MODERATOR_USERNAME}' not found. Run db:seed first.`,
      );
    }

    let created = 0;
    for (let i = 0; i < count; i++) {
      const sequenceNumber = i + 1;
      const content = getDemoSubmissionContent(i);
      const image = await generateDemoImage(sequenceNumber);
      const imagePath = `submissions/${crypto.randomUUID()}.png`;
      await storage.uploadImage(image, imagePath);
      const imageUrl = storage.getImageUrl(imagePath);

      const submission = await repo.createSubmission({
        image_url: imageUrl,
        message: content.message,
        submitter_name: content.submitterName,
        social_handle: content.socialHandle,
        source: DEMO_SEED_SOURCE,
        source_metadata: { demo_seed: true, sequence: sequenceNumber },
      });

      await repo.updateSubmissionStatus(submission.id, "approved", moderator.id);
      created++;
    }

    // Pending (un-approved) submissions to exercise the moderation queue, including
    // a subset flagged by the seeded auto-moderator (FR-09a) — left in `pending`.
    const autoModerator = new AutoModeratorServiceImpl();
    let pendingCreated = 0;
    let flaggedCreated = 0;
    for (let i = 0; i < pending; i++) {
      const sequenceNumber = count + i + 1;
      const content = getPendingDemoContent(i);
      const flag = autoModerator.checkMessage(content.message, SEEDED_DEFAULT_WORD_LIST);
      const image = await generateDemoImage(sequenceNumber);
      const imagePath = `submissions/${crypto.randomUUID()}.png`;
      await storage.uploadImage(image, imagePath);
      const imageUrl = storage.getImageUrl(imagePath);

      await repo.createSubmission({
        image_url: imageUrl,
        message: content.message,
        submitter_name: content.submitterName,
        social_handle: content.socialHandle,
        source: DEMO_SEED_SOURCE,
        source_metadata: { demo_seed: true, demo_pending: true, sequence: sequenceNumber },
        flagged_words: flag.flagged_words,
        is_flagged: flag.is_flagged,
      });

      pendingCreated++;
      if (flag.is_flagged) flaggedCreated++;
    }

    return { created, pendingCreated, flaggedCreated, skipped: false, removed };
  } finally {
    await repo.close();
    await client.end();
  }
}

if (import.meta.main) {
  const { count, pending, force } = parseSeedDemoArgs(Deno.args);
  const result = await runSeedDemoSubmissions({ count, pending, force });

  if (result.skipped) {
    console.log("Demo submissions already seeded. Use --force to replace.");
  } else {
    if (result.removed > 0) {
      console.log(`✓ Removed ${result.removed} prior demo submission(s)`);
    }
    console.log(`✓ Seeded ${result.created} approved demo submission(s)`);
    console.log(
      `✓ Seeded ${result.pendingCreated} pending demo submission(s) (${result.flaggedCreated} flagged for moderation)`,
    );
  }
  console.log("Demo seed complete.");
}
