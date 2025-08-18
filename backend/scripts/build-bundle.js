#!/usr/bin/env node

/**
 * Build script for esbuild bundling
 *
 * This script bundles the Node.js CLI application using esbuild.
 * Version information is handled via the auto-generated version.ts file.
 */

import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { dirname } from "path";

// Build CLI bundle
await build({
  entryPoints: ["cli/node.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/cli/node.js",
  external: [
    "@anthropic-ai/claude-code",
    "@anthropic-ai/sdk",
    "@hono/node-server",
    "hono",
    "commander",
    "openai",
    "node-fetch",
    "formdata-node",
    "abort-controller", 
    "form-data-encoder",
    "formdata-node/file-from-path",
  ],
  sourcemap: true,
});

// Build Lambda handler
await build({
  entryPoints: ["lambda.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/lambda.js",
  external: [
    "@anthropic-ai/claude-code",
  ],
  sourcemap: true,
});

// Copy auth files to dist directory
try {
  mkdirSync("dist/auth", { recursive: true });
  copyFileSync("auth/preload-script.cjs", "dist/auth/preload-script.cjs");
  console.log("✅ Auth files copied to dist directory");
} catch (error) {
  console.warn("⚠️ Failed to copy auth files:", error.message);
}

console.log("✅ CLI bundle created successfully");
console.log("✅ Lambda bundle created successfully");
