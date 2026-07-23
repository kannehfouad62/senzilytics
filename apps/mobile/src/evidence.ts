import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

export const MAX_MOBILE_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_FILES_PER_RECORD = 5;

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "text/plain",
  "text/csv",
]);

export type SelectedEvidence = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  bytes: Uint8Array;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
};

export async function capturePhotoEvidence() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera access is required to capture photo evidence.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => readEvidenceAsset({
    uri: asset.uri,
    fileName: asset.fileName || `evidence-${Date.now()}.jpg`,
    mimeType: asset.mimeType || "image/jpeg",
    sizeBytes: asset.fileSize,
  })));
}

export async function pickPhotoEvidence(selectionLimit = MAX_EVIDENCE_FILES_PER_RECORD) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo access is required to select photo evidence.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(selectionLimit, MAX_EVIDENCE_FILES_PER_RECORD)),
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => readEvidenceAsset({
    uri: asset.uri,
    fileName: asset.fileName || `evidence-${Date.now()}.jpg`,
    mimeType: asset.mimeType || "image/jpeg",
    sizeBytes: asset.fileSize,
  })));
}

export async function pickEvidenceFiles() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...supportedMimeTypes],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => readEvidenceAsset({
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType || inferMimeType(asset.name),
    sizeBytes: asset.size,
  })));
}

async function readEvidenceAsset(input: {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}): Promise<SelectedEvidence> {
  if (!supportedMimeTypes.has(input.mimeType)) {
    throw new Error("Use a PDF, Word, Excel, text, CSV, JPEG, PNG, WebP, or MP4 evidence file.");
  }
  if (input.sizeBytes && input.sizeBytes > MAX_MOBILE_EVIDENCE_BYTES) {
    throw new Error("Mobile evidence files must be 10 MB or smaller.");
  }
  const temporaryFile = new File(input.uri);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await temporaryFile.arrayBuffer());
  } finally {
    if (input.uri.startsWith("file://")) {
      try { temporaryFile.delete(); } catch { /* The OS may own this URI. */ }
    }
  }
  if (!bytes.byteLength) throw new Error("The selected evidence file is empty.");
  if (bytes.byteLength > MAX_MOBILE_EVIDENCE_BYTES) {
    throw new Error("Mobile evidence files must be 10 MB or smaller.");
  }
  const digest = new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
  );
  return {
    id: Crypto.randomUUID(),
    fileName: sanitizeFileName(input.fileName),
    mimeType: input.mimeType,
    sizeBytes: bytes.byteLength,
    checksum: Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join(""),
    bytes,
    kind: input.mimeType.startsWith("image/")
      ? "PHOTO"
      : input.mimeType.startsWith("video/")
        ? "VIDEO"
        : "DOCUMENT",
  };
}

function sanitizeFileName(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+|[-.]+$/g, "")
    .slice(0, 160);
  return normalized || `evidence-${Date.now()}`;
}

function inferMimeType(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "xls") return "application/vnd.ms-excel";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "mp4") return "video/mp4";
  if (extension === "csv") return "text/csv";
  return "application/octet-stream";
}
