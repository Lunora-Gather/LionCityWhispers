const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${configuredBasePath}${normalized}`;
}

export function publicBasePath() {
  return configuredBasePath;
}
