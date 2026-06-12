import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const githubPages = process.env.GITHUB_PAGES === "1";
const githubPagesRepo = process.env.GITHUB_PAGES_REPO ?? "LionCityWhispers";
const githubPagesBasePath = `/${githubPagesRepo.replace(/^\/+|\/+$/g, "")}`;
const basePath = githubPages ? githubPagesBasePath : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(githubPages
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        images: {
          unoptimized: true
        }
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  turbopack: {
    root
  }
};

export default nextConfig;
