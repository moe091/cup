const S3_BASE_URL = import.meta.env.VITE_S3_BASE_URL;
let hasWarnedMissingS3BaseUrl = false;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function buildS3AssetUrl(objectKey: string | null | undefined): string | null {
  console.log("s3baseurl: ", S3_BASE_URL);
  if (!objectKey) {
    return null;
  }

  if (!S3_BASE_URL) {
    if (import.meta.env.DEV && !hasWarnedMissingS3BaseUrl) {
      hasWarnedMissingS3BaseUrl = true;
      console.warn("[s3] VITE_S3_BASE_URL is not configured; persisted S3 asset URLs will not resolve.");
    }

    return null;
  }

  const base = trimSlashes(S3_BASE_URL);
  const key = trimSlashes(objectKey);
  return `${base}/${key}`;
}
