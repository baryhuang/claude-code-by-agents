/**
 * Path utilities for conversation history functionality
 * Handles conversion between project paths and Claude history directory names
 */

import type { Runtime } from "../runtime/types.ts";

/**
 * Get the encoded directory name for a project path by checking what actually exists
 * Example: "/Users/sugyan/tmp/" → "-Users-sugyan-tmp"
 */
export async function getEncodedProjectName(
  projectPath: string,
  runtime: Runtime,
): Promise<string | null> {
  const homeDir = runtime.getHomeDir();
  if (!homeDir) {
    return null;
  }

  const projectsDir = `${homeDir}/.claude/projects`;

  try {
    // Read all directories in .claude/projects
    const entries = [];
    for await (const entry of runtime.readDir(projectsDir)) {
      if (entry.isDirectory) {
        entries.push(entry.name);
      }
    }

    // Convert project path to expected encoded format for comparison
    const normalizedPath = projectPath.replace(/\/$/, "");
    // Claude converts '/', '\', ':', and '.' to '-'
    const expectedEncoded = normalizedPath.replace(/[/\\:.]/g, "-");

    console.log(`🔍 Looking for project: ${projectPath}`);
    console.log(`🔍 Expected encoded: ${expectedEncoded}`);
    console.log(`🔍 Available directories: ${entries.join(", ")}`);

    // First try exact match
    if (entries.includes(expectedEncoded)) {
      console.log(`🔍 Found exact match: ${expectedEncoded}`);
      return expectedEncoded;
    }

    // If no exact match, look for directories that start with the encoded path
    // This handles cases where history exists for subdirectories within the project
    const matchingDirs = entries.filter(entry => entry.startsWith(expectedEncoded + "-"));
    if (matchingDirs.length > 0) {
      console.log(`🔍 Found matching subdirectories: ${matchingDirs.join(", ")}`);
      // Return the first matching directory as representative
      return matchingDirs[0];
    }

    console.log(`🔍 No match found for ${expectedEncoded}`);
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that an encoded project name is safe
 */
export function validateEncodedProjectName(encodedName: string): boolean {
  // Should not be empty
  if (!encodedName) {
    return false;
  }

  // Should not contain dangerous characters for directory names
  // deno-lint-ignore no-control-regex
  const dangerousChars = /[<>:"|?*\x00-\x1f\/\\]/;
  if (dangerousChars.test(encodedName)) {
    return false;
  }

  return true;
}
