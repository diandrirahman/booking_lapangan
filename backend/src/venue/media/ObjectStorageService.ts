import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import type { Environment } from "../../config/environment.js";
import { ApiError } from "../../http/ApiError.js";

const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const MIME_EXTENSION = new Map([
  ["image/webp", ".webp"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(private readonly environment: Environment) {
    this.client = new S3Client({
      endpoint: environment.S3_ENDPOINT,
      region: environment.S3_REGION,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: environment.S3_ACCESS_KEY,
        secretAccessKey: environment.S3_SECRET_KEY,
      },
    });
  }

  async ping(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.environment.S3_BUCKET }),
    );
  }

  async ensureBucket(): Promise<void> {
    if (!this.environment.S3_MANAGE_BUCKET) {
      await this.ping();
      return;
    }
    try {
      await this.ping();
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.environment.S3_BUCKET }),
      );
    }
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.environment.S3_BUCKET,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedMethods: ["PUT"],
                AllowedOrigins: [this.environment.APP_ORIGIN],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 300,
              },
            ],
          },
        }),
      );
    } catch (error) {
      // MinIO configures CORS globally and does not implement PutBucketCors.
      // A production S3 provider must accept the bucket-level policy.
      if (this.environment.NODE_ENV === "production") throw error;
    }
  }

  async verifyUpload(
    storageKey: string,
    mimeType: string,
    byteSize: number,
  ): Promise<void> {
    try {
      const object = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.environment.S3_BUCKET,
          Key: storageKey,
        }),
      );
      if (object.ContentType !== mimeType || object.ContentLength !== byteSize) {
        throw new ApiError(
          422,
          "UPLOAD_METADATA_MISMATCH",
          "Metadata file tidak sesuai dengan permintaan upload.",
        );
      }
      const content = await this.client.send(
        new GetObjectCommand({
          Bucket: this.environment.S3_BUCKET,
          Key: storageKey,
          Range: "bytes=0-11",
        }),
      );
      const bytes = Buffer.from((await content.Body?.transformToByteArray()) ?? []);
      if (!hasExpectedImageSignature(bytes, mimeType)) {
        throw new ApiError(
          422,
          "UPLOAD_CONTENT_INVALID",
          "Isi file tidak sesuai dengan format gambar yang dipilih.",
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        422,
        "UPLOAD_NOT_FOUND",
        "File belum selesai diunggah atau tidak ditemukan.",
      );
    }
  }

  async createSignedUpload(
    userId: string,
    tenantId: string,
    venueId: string,
    fileName: string,
    mimeType: string,
    byteSize: number,
  ): Promise<{ storageKey: string; uploadUrl: string; expiresInSeconds: number }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ApiError(422, "UNSUPPORTED_MEDIA_TYPE", "Format file tidak didukung.");
    }
    if (byteSize <= 0 || byteSize > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        422,
        "UPLOAD_SIZE_INVALID",
        "Ukuran file harus di bawah 10 MB.",
      );
    }
    const extension = safeExtension(fileName);
    if (!extension || !extensionMatchesMimeType(extension, mimeType)) {
      throw new ApiError(
        422,
        "UPLOAD_EXTENSION_MISMATCH",
        "Ekstensi file tidak sesuai dengan format gambar.",
      );
    }
    const storageKey = `uploads/${tenantId}/${venueId}/${userId}/${ulid()}${extension}`;
    const expiresInSeconds = 300;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.environment.S3_BUCKET,
        Key: storageKey,
        ContentType: mimeType,
        ContentLength: byteSize,
        Metadata: { uploader: userId },
      }),
      { expiresIn: expiresInSeconds },
    );
    return { storageKey, uploadUrl, expiresInSeconds };
  }

  async listUploadsOlderThan(cutoff: Date, limit = 100): Promise<string[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.environment.S3_BUCKET,
        Prefix: "uploads/",
        MaxKeys: 1_000,
      }),
    );
    return (result.Contents ?? [])
      .filter(
        (object): object is typeof object & { Key: string } =>
          Boolean(object.Key) &&
          Boolean(object.LastModified && object.LastModified < cutoff),
      )
      .slice(0, limit)
      .map((object) => object.Key);
  }

  async deleteUpload(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.environment.S3_BUCKET,
        Key: storageKey,
      }),
    );
  }
}

function safeExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.(webp|jpe?g|png)$/);
  return match ? match[0].replace("jpeg", "jpg") : "";
}

function extensionMatchesMimeType(extension: string, mimeType: string): boolean {
  return MIME_EXTENSION.get(mimeType) === extension;
}

export function hasExpectedImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  }
  if (mimeType === "image/jpeg") {
    return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
