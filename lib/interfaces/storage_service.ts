export interface StorageService {
  uploadImage(file: Blob, path: string): Promise<string>;
  getImageUrl(imagePath: string): string;
  deleteImage(imagePath: string): Promise<void>;
}
