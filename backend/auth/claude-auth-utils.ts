import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Prepares the authentication environment for Claude Code CLI execution
 * This includes setting up environment variables and preload script
 * to intercept security commands and provide OAuth credentials
 */
export async function prepareClaudeAuthEnvironment(): Promise<{
  env: Record<string, string>;
  executableArgs: string[];
}> {
  // Check if we have valid OAuth credentials by reading from the credentials file
  const credentialsPath = path.join(
    process.env.HOME || process.cwd(),
    ".claude-credentials.json"
  );
  
  let hasValidCredentials = false;
  try {
    const fs = await import("fs");
    const credentialsData = await fs.promises.readFile(credentialsPath, "utf8");
    const credentials = JSON.parse(credentialsData);
    
    // Check if we have a valid access token
    if (credentials?.claudeAiOauth?.accessToken && credentials?.claudeAiOauth?.expiresAt) {
      const now = Date.now();
      const expiresAt = credentials.claudeAiOauth.expiresAt;
      // Consider valid if expires more than 5 minutes from now
      hasValidCredentials = expiresAt > (now + 5 * 60 * 1000);
    }
  } catch (error) {
    // Credentials file doesn't exist or is invalid
    hasValidCredentials = false;
  }
  
  if (!hasValidCredentials) {
    console.log("[AUTH] No valid OAuth credentials found, skipping auth setup");
    return {
      env: {},
      executableArgs: []
    };
  }

  // Get the preload script path - it should be relative to the backend directory
  const preloadScriptPath = path.resolve(
    __dirname,
    "../../auth/preload-script.js"
  );

  // Use the same credentials path

  // Create the authentication environment
  const authEnv: Record<string, string> = {
    // Set the credentials path for the preload script to read from
    CLAUDE_CREDENTIALS_PATH: credentialsPath,
    // Enable debug logging for the preload script if needed
    DEBUG_PRELOAD_SCRIPT: process.env.DEBUG_PRELOAD_SCRIPT || "0",
  };

  // Add NODE_OPTIONS to include the preload script
  const nodeOptions = `--require "${preloadScriptPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  authEnv.NODE_OPTIONS = nodeOptions;

  // Add Claude configuration directories
  authEnv.CLAUDE_CONFIG_DIR = path.join(process.env.HOME || process.cwd(), ".claude-config");
  authEnv.CLAUDE_CREDENTIALS_PATH = credentialsPath;

  console.log("[AUTH] Prepared Claude auth environment:");
  console.log(`[AUTH] Preload script: ${preloadScriptPath}`);
  console.log(`[AUTH] Credentials path: ${credentialsPath}`);
  console.log(`[AUTH] NODE_OPTIONS: ${nodeOptions}`);

  return {
    env: authEnv,
    executableArgs: []
  };
}

/**
 * Placeholder for writing credentials file - this is handled by the Electron main process
 * The backend just checks if credentials exist and uses them
 */
export async function writeClaudeCredentialsFile(): Promise<void> {
  // In the backend context, we don't write credentials - they are managed by the Electron main process
  // This function is a no-op for backend builds
  console.log("[AUTH] Backend context - credentials are managed by Electron main process");
}