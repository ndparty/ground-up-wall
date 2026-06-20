import { join } from "@std/path";
import { Client } from "@db/postgres";
import { loadConfig } from "../lib/config.ts";
import { normalizeDatabaseUrl } from "../lib/db_url.ts";
import { loadEnvFile } from "../lib/load_env.ts";
import { FileStorageService } from "../lib/repositories/file_storage_service.ts";
import { PostgresRepository } from "../lib/repositories/postgres_repository.ts";
import { getDemoSubmissionContent } from "../lib/seed/demo_submission_content.ts";
import { generateDemoImage } from "../lib/seed/generate_demo_image.ts";
import { MODERATOR_USERNAME, runSeed } from "./seed.ts";

export const DEMO_SEED_SOURCE = "demo_seed";
export const DEFAULT_DEMO_SEED_COUNT = 40;

export interface SeedDemoSubmissionsOptions {
  count?: number;
  force?: boolean;
  databaseUrl?: string;
}

export interface SeedDemoSubmissionsResult {
  created: number;
  skipped: boolean;
  removed: number;
}

interface DemoSeedRow {
  id: string;
  image_url: string;
}

export function parseSeedDemoArgs(args: string[]): { count: number; force: boolean } {
  let count = DEFAULT_DEMO_SEED_COUNT;
  let force = false;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    const countMatch = arg.match(/^--count=(\d+)$/);
    if (countMatch) {
      count = Math.max(1, Number.parseInt(countMatch[1], 10));
    }
  }

  return { count, force };
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
      return { created: 0, skipped: true, removed: 0 };
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

    return { created, skipped: false, removed };
  } finally {
    await repo.close();
    await client.end();
  }
}

if (import.meta.main) {
  const { count, force } = parseSeedDemoArgs(Deno.args);
  const result = await runSeedDemoSubmissions({ count, force });

  if (result.skipped) {
    console.log("Demo submissions already seeded. Use --force to replace.");
  } else {
    if (result.removed > 0) {
      console.log(`✓ Removed ${result.removed} prior demo submission(s)`);
    }
    console.log(`✓ Seeded ${result.created} approved demo submission(s)`);
  }
  console.log("Demo seed complete.");
}
