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
      
      console.log(`[AUTH] Found credentials for user: ${credentials.claudeAiOauth.account?.email_address}`);
      console.log(`[AUTH] Token expires at: ${new Date(expiresAt).toISOString()}`);
      console.log(`[AUTH] Current time: ${new Date(now).toISOString()}`);
      console.log(`[AUTH] Token valid: ${hasValidCredentials}`);
    } else {
      console.log(`[AUTH] Missing required credential fields:`);
      console.log(`[AUTH] - accessToken: ${!!credentials?.claudeAiOauth?.accessToken}`);
      console.log(`[AUTH] - expiresAt: ${!!credentials?.claudeAiOauth?.expiresAt}`);
    }
  } catch (error) {
    // Credentials file doesn't exist or is invalid
    console.log(`[AUTH] Could not read credentials file: ${error instanceof Error ? error.message : String(error)}`);
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
    "./preload-script.cjs"
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
  
  // Verify preload script exists
  const fs = await import("fs");
  if (!fs.existsSync(preloadScriptPath)) {
    console.error(`[AUTH] ERROR: Preload script not found at ${preloadScriptPath}`);
    console.error(`[AUTH] __dirname is: ${__dirname}`);
    console.error(`[AUTH] Resolved path is: ${preloadScriptPath}`);
  } else {
    console.log(`[AUTH] Preload script verified at ${preloadScriptPath}`);
    console.log(`[AUTH] NODE_OPTIONS will be: ${nodeOptions}`);
  }

  return {
    env: authEnv,
    executableArgs: []
  };
}

/**
 * Writes OAuth credentials to the credentials file
 * @param claudeAuth - OAuth credentials to write, if not provided uses existing file
 */
export async function writeClaudeCredentialsFile(claudeAuth?: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  subscriptionType: string;
  account: {
    email_address: string;
    uuid: string;
  };
}): Promise<void> {
  const credentialsPath = path.join(
    process.env.HOME || process.cwd(),
    ".claude-credentials.json"
  );

  if (claudeAuth) {
    // Write provided OAuth credentials
    const credentials = {
      claudeAiOauth: claudeAuth
    };
    
    const fs = await import("fs");
    await fs.promises.writeFile(
      credentialsPath, 
      JSON.stringify(credentials, null, 2), 
      { mode: 0o600 }
    );
    
    console.log("[AUTH] OAuth credentials written to:", credentialsPath);
    console.log("[AUTH] Credentials written for user:", claudeAuth.account?.email_address);
    console.log("[AUTH] Token expires at:", new Date(claudeAuth.expiresAt).toISOString());
    
    // Verify the file was written correctly by reading it back
    try {
      const writtenData = await fs.promises.readFile(credentialsPath, "utf8");
      const parsedData = JSON.parse(writtenData);
      console.log("[AUTH] Credentials file content preview:");
      console.log("[AUTH] - Has claudeAiOauth:", !!parsedData.claudeAiOauth);
      console.log("[AUTH] - Has accessToken:", !!parsedData.claudeAiOauth?.accessToken);
      console.log("[AUTH] - AccessToken length:", parsedData.claudeAiOauth?.accessToken?.length || 0);
      console.log("[AUTH] - Has refreshToken:", !!parsedData.claudeAiOauth?.refreshToken);
      if (parsedData.claudeAiOauth?.accessToken) {
        console.log("[AUTH] Verification: Credentials file written and readable");
      } else {
        console.log("[AUTH] WARNING: Credentials file written but missing accessToken");
      }
    } catch (verifyError) {
      console.log("[AUTH] ERROR: Could not verify written credentials file:", verifyError);
    }
  } else {
    // In the backend context without provided auth, credentials are managed by the Electron main process
    console.log("[AUTH] Backend context - using existing credentials file");
  }
}