/**
 * Copy a picked file's bytes into memory immediately after selection.
 *
 * On Android, `File` handles from `<input type="file">` are backed by content
 * URIs that can go stale before submit (picker activity reclaimed, temp file
 * cleaned up), making later reads fail even though the preview rendered.
 * Reading the bytes up front makes every later read (preview, submit) hit
 * memory instead of the provider.
 */
export async function snapshotUploadFile(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch {
    // Snapshot failed (already-stale handle or low memory): keep the original
    // reference; the robust decode pipeline still gets a chance at submit.
    return file;
  }
}
