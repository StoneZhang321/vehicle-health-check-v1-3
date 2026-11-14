/** 中文：照片在本机解码缩放并移除元数据，避免大图阻塞检测和报告。 English: Decode, resize and strip photo metadata locally for dependable inspections and reports. */
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 100_000_000;
const MAX_OUTPUT_EDGE = 2_560;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const DECODE_TIMEOUT_MS = 12_000;

export interface SanitizedEvidenceImage {
  blob: Blob;
  mediaType: "image/jpeg";
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  originalSha256: string;
  sanitizerVersion: "browser-canvas-v1";
}

export class EvidenceSanitizationError extends Error {
  constructor(
    readonly code:
      | "FILE_SIZE_INVALID"
      | "FILE_SIGNATURE_MISMATCH"
      | "IMAGE_DECODE_FAILED"
      | "IMAGE_DIMENSIONS_INVALID"
      | "IMAGE_OUTPUT_TOO_LARGE",
  ) {
    super(code);
    this.name = "EvidenceSanitizationError";
  }
}

/** 中文：计算附件内容摘要，用于备份恢复时核对真实字节。 English: Hash attachment bytes for backup integrity checks. */
export async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** 中文：核对图片签名、尺寸与容量，再输出不含原始元数据的JPEG。 English: Validate image signatures, dimensions and size, then produce JPEG without original metadata. */
export async function sanitizeEvidenceImage(
  file: File,
): Promise<SanitizedEvidenceImage> {
  if (file.size < 1 || file.size > MAX_INPUT_BYTES) {
    throw new EvidenceSanitizationError("FILE_SIZE_INVALID");
  }
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (!isSupportedImageSignature(header)) {
    throw new EvidenceSanitizationError("FILE_SIGNATURE_MISMATCH");
  }

  const originalSha256Promise = sha256Blob(file);
  const decoded = await decodeLocalImage(file);
  try {
    if (
      decoded.width < 1 ||
      decoded.height < 1 ||
      decoded.width * decoded.height > MAX_SOURCE_PIXELS
    ) {
      throw new EvidenceSanitizationError("IMAGE_DIMENSIONS_INVALID");
    }
    const scale = Math.min(
      1,
      MAX_OUTPUT_EDGE / Math.max(decoded.width, decoded.height),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: false,
    });
    if (!context) {
      throw new EvidenceSanitizationError("IMAGE_DECODE_FAILED");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await canvasToJpeg(canvas);
    canvas.width = 1;
    canvas.height = 1;
    if (blob.size < 1 || blob.size > MAX_OUTPUT_BYTES) {
      throw new EvidenceSanitizationError("IMAGE_OUTPUT_TOO_LARGE");
    }
    const [sha256, originalSha256] = await Promise.all([
      sha256Blob(blob),
      originalSha256Promise,
    ]);
    return {
      blob,
      mediaType: "image/jpeg",
      width,
      height,
      byteSize: blob.size,
      sha256,
      originalSha256,
      sanitizerVersion: "browser-canvas-v1",
    };
  } finally {
    decoded.cleanup();
  }
}

/** 中文：识别实际图片字节，不能只相信文件扩展名。 English: Identify image bytes rather than trusting file extensions. */
function isSupportedImageSignature(bytes: Uint8Array): boolean {
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const box =
    bytes.length >= 12
      ? String.fromCharCode(...bytes.slice(4, 8))
      : "";
  const brand =
    bytes.length >= 12
      ? String.fromCharCode(...bytes.slice(8, 12))
      : "";
  const heic =
    box === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
  return jpeg || png || heic;
}

/** 中文：使用浏览器解码本机图片，并返回释放资源的方法。 English: Decode local images with the browser and return resource cleanup. */
async function decodeLocalImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    }
  } catch {
    // Fall through to the browser image decoder for implementations that
    // expose createImageBitmap but do not support the selected format.
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      const timeout = globalThis.setTimeout(() => {
        candidate.src = "";
        reject(new EvidenceSanitizationError("IMAGE_DECODE_FAILED"));
      }, DECODE_TIMEOUT_MS);
      candidate.onload = () => {
        globalThis.clearTimeout(timeout);
        resolve(candidate);
      };
      candidate.onerror = () => {
        globalThis.clearTimeout(timeout);
        reject(new EvidenceSanitizationError("IMAGE_DECODE_FAILED"));
      };
      candidate.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** 中文：将已缩放画布编码成JPEG，编码失败时明确拒绝保存。 English: Encode the resized canvas as JPEG and reject failed encodes. */
function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new EvidenceSanitizationError("IMAGE_DECODE_FAILED"));
      },
      "image/jpeg",
      0.86,
    );
  });
}
