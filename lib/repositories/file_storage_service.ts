import { dirname, join } from "@std/path";
import type { StorageService } from "../interfaces/storage_service.ts";

export class FileStorageService implements StorageService {
  constructor(private basePath: string = "./uploads") {}

  async uploadImage(file: Blob, path: string): Promise<string> {
    const fullPath = join(this.basePath, path);
    const dir = dirname(fullPath);
    await Deno.mkdir(dir, { recursive: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    await Deno.writeFile(fullPath, bytes);
    return path;
  }

  getImageUrl(imagePath: string): string {
    return `/${imagePath}`;
  }

  async deleteImage(imagePath: string): Promise<void> {
    const fullPath = join(this.basePath, imagePath);
    try {
      await Deno.remove(fullPath);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
  }
}
