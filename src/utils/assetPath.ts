const absoluteUrlPattern = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const configuredBasePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/+$/g, "");

export function assetPath(path: string) {
  if (absoluteUrlPattern.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return configuredBasePath ? `${configuredBasePath}${normalized}` : normalized;
}

export function publicBasePath() {
  return configuredBasePath;
}
