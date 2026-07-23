import * as Crypto from "expo-crypto";
import { mobileApi } from "./api";

type UploadResult = {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
  etag: string;
};

export async function uploadPrivateMobileEvidence(input: {
  pathname: string;
  body: ArrayBuffer;
  contentType: string;
  clientPayload: string;
}) {
  const tokenResponse = await mobileApi<{ clientToken: string }>(
    "/api/mobile/evidence/upload",
    {
      method: "POST",
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: input.pathname,
          clientPayload: input.clientPayload,
          multipart: false,
        },
      }),
    }
  );
  const storeId = clientTokenStoreId(tokenResponse.clientToken);
  const response = await fetch(
    `https://vercel.com/api/blob/?pathname=${encodeURIComponent(input.pathname)}`,
    {
      method: "PUT",
      body: input.body,
      headers: {
        authorization: `Bearer ${tokenResponse.clientToken}`,
        "x-api-blob-request-id": `${storeId}:${Date.now()}:${Crypto.randomUUID()}`,
        "x-vercel-blob-store-id": storeId,
        "x-api-blob-request-attempt": "0",
        "x-api-version": "12",
        "x-vercel-blob-access": "private",
        "x-content-type": input.contentType,
      },
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message || "Private evidence upload failed.");
  }
  return await response.json() as UploadResult;
}

function clientTokenStoreId(token: string) {
  const parts = token.split("_");
  const storeId = parts[0] === "vercel" &&
    parts[1] === "blob" &&
    parts[2] === "client"
    ? parts[3]
    : "";
  if (!storeId) throw new Error("The private evidence upload token is invalid.");
  return storeId;
}
