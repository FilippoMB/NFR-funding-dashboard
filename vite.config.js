import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const fallbackRepoName = "NFR-funding-dashboard";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ??
  process.env.PAGES_REPOSITORY_NAME ??
  fallbackRepoName;
const explicitBasePath = process.env.PAGES_BASE_PATH;

export default defineConfig(({ command }) => ({
  base:
    command === "build"
      ? explicitBasePath ?? `/${repositoryName}/`
      : "/",
  plugins: [react()]
}));
