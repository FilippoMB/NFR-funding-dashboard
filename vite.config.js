import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const fallbackRepoName = "NFR-funding-stats";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? fallbackRepoName;

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${repositoryName}/` : "/",
  plugins: [react()]
}));
