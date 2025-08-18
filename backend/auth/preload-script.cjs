// Check if logging is enabled via environment variable
const loggingEnabled =
  process.env.DEBUG_PRELOAD_SCRIPT === "1" ||
  process.env.DEBUG_PRELOAD_SCRIPT === "true";

// Patch child_process to prevent security commands
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const originalExecSync = childProcess.execSync;

function logToFile(...args) {
  try {
    const logFilePath = path.join(os.homedir(), ".preload-script.log");
    const timestamp = new Date().toISOString();
    const message = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    // Fallback: do nothing if logging fails
  }
}

// Patch console.log and console.error to use logToFile
//console.log = (...args) => logToFile(...args);
//console.error = (...args) => logToFile("ERROR:", ...args);

// === macOS Security Commands Patching ===
childProcess.execSync = function (command, options) {
  // Check if command starts with "security "
  if (
    typeof command === "string" &&
    command.trim().startsWith("security find-generic-password ")
  ) {
    if (loggingEnabled) {
      console.log("[PRELOAD] Intercepted execSync call:", command);
      console.log("[PRELOAD] Environment check - CLAUDE_CREDENTIALS_PATH:", process.env.CLAUDE_CREDENTIALS_PATH);
    }

    // Check if CLAUDE_CREDENTIALS_PATH is set
    const credentialsPath = process.env.CLAUDE_CREDENTIALS_PATH;
    if (credentialsPath) {
      try {
        if (loggingEnabled) {
          console.log("📁 Reading credentials from:", credentialsPath);
        }
        // Read file and return its contents as buffer
        const credentials = fs.readFileSync(credentialsPath, "utf8");
        return Buffer.from(credentials);
      } catch (error) {
        if (loggingEnabled) {
          console.error("❌ Error reading credentials file:", error.message);
        }
        // Fall back to empty buffer if file can't be read
        return Buffer.from("");
      }
    } else {
      if (loggingEnabled) {
        console.log(
          "⚠️ CLAUDE_CREDENTIALS_PATH not set, returning empty buffer"
        );
      }
      // Return empty buffer to mimic successful execution
      return Buffer.from("");
    }
  }

  // Check if command starts with "security "
  if (typeof command === "string" && command.trim().startsWith("security ")) {
    if (loggingEnabled) {
      console.log("🚫 Blocked execSync call:", command);
    }
    // Return empty buffer to mimic successful execution
    return Buffer.from("");
  }

  if (loggingEnabled) {
    console.log("🔧 Allowed execSync call:", command);
  }

  return originalExecSync.apply(this, arguments);
};

// === macOS Security Commands Patching ===
const originalSpawnSync = childProcess.spawnSync;

// Helper function to create spawnSync return format
function createSpawnSyncResult(stdout = "", stderr = "", status = 0) {
  return {
    pid: 0,
    output: [null, stdout, stderr],
    stdout: stdout,
    stderr: stderr,
    status: status,
    signal: null,
    error: null,
  };
}

childProcess.spawnSync = function (command) {
  // Check if command starts with "security "
  if (
    typeof command === "string" &&
    command.trim().startsWith("security find-generic-password ")
  ) {
    if (loggingEnabled) {
      console.log("🔀 Intercepted spawnSync call:", command);
      console.log("🔍 Environment check - CLAUDE_CREDENTIALS_PATH:", process.env.CLAUDE_CREDENTIALS_PATH);
    }

    // Check if CLAUDE_CREDENTIALS_PATH is set
    const credentialsPath = process.env.CLAUDE_CREDENTIALS_PATH;
    if (credentialsPath) {
      try {
        if (loggingEnabled) {
          console.log("📁 Reading credentials from:", credentialsPath);
        }
        // Read file and return its contents in spawnSync format
        const credentials = fs.readFileSync(credentialsPath, "utf8");
        return createSpawnSyncResult(credentials);
      } catch (error) {
        if (loggingEnabled) {
          console.error("❌ Error reading credentials file:", error.message);
        }
        // Fall back to empty result if file can't be read
        return createSpawnSyncResult();
      }
    } else {
      if (loggingEnabled) {
        console.log(
          "⚠️ CLAUDE_CREDENTIALS_PATH not set, returning empty result"
        );
      }
      // Return empty result to mimic successful execution
      return createSpawnSyncResult();
    }
  }

  // Check if command starts with "security "
  if (typeof command === "string" && command.trim().startsWith("security ")) {
    if (loggingEnabled) {
      console.log("🚫 Blocked spawnSync call:", command);
    }
    // Return empty result to mimic successful execution
    return createSpawnSyncResult();
  }

  if (loggingEnabled) {
    console.log("🔧 Allowed spawnSync call:", command);
  }

  return originalSpawnSync.apply(this, arguments);
};

// === Windows Credential File Support ===
if (process.platform === "win32") {
  const originalExistsSync = fs.existsSync;
  const originalReadFileSync = fs.readFileSync;
  const originalWriteFileSync = fs.writeFileSync;
  const originalUnlinkSync = fs.unlinkSync;
  const originalChmodSync = fs.chmodSync;

  // Hook fs.existsSync to handle credential files
  fs.existsSync = function (filePath) {
    if (
      typeof filePath === "string" &&
      filePath.endsWith(".credentials.json")
    ) {
      if (loggingEnabled) {
        console.log("[PRELOAD] Mocking existsSync for credentials file:", filePath);
      }
      return true;
    }

    return originalExistsSync.apply(this, arguments);
  };

  // Hook fs.readFileSync to handle credential files
  fs.readFileSync = function (filePath, options) {
    if (
      typeof filePath === "string" &&
      filePath.endsWith(".credentials.json")
    ) {
      if (loggingEnabled) {
        console.log(
          "🔀 Intercepted readFileSync for credentials file:",
          filePath
        );
      }

      // Check if CLAUDE_CREDENTIALS_PATH is set
      const credentialsPath = process.env.CLAUDE_CREDENTIALS_PATH;
      if (credentialsPath) {
        try {
          if (loggingEnabled) {
            console.log("📁 Reading credentials from:", credentialsPath);
          }
          // Read file and parse as JSON
          const credentialsData = originalReadFileSync.call(
            this,
            credentialsPath,
            "utf8"
          );
          const credentials = JSON.parse(credentialsData);

          // Keep refreshToken as-is for OAuth authentication
          if (loggingEnabled) {
            console.log("[PRELOAD] Using OAuth credentials with refreshToken");
          }

          // Return as string or buffer depending on options
          const result = JSON.stringify(credentials);

          if (loggingEnabled) {
            console.log("🔍 Returning credentials data to Claude Code");
          }

          if (
            options &&
            typeof options === "object" &&
            options.encoding === null
          ) {
            return Buffer.from(result);
          }
          return result;
        } catch (error) {
          if (loggingEnabled) {
            console.error(
              "❌ Error reading/parsing credentials file:",
              error.message
            );
          }
          // Fall back to empty string if file can't be read or parsed
          return "";
        }
      } else {
        if (loggingEnabled) {
          console.log(
            "⚠️ CLAUDE_CREDENTIALS_PATH not set, returning empty string"
          );
        }
        // Return empty string to mimic file not found
        return "";
      }
    }

    return originalReadFileSync.apply(this, arguments);
  };

  // Hook fs.writeFileSync to be a no-op for credential files
  fs.writeFileSync = function (filePath, data, options) {
    if (
      typeof filePath === "string" &&
      filePath.endsWith(".credentials.json")
    ) {
      if (loggingEnabled) {
        console.log("🚫 Blocked writeFileSync for credentials file:", filePath);
      }
      // No-op - do nothing
      return;
    }

    return originalWriteFileSync.apply(this, arguments);
  };

  // Hook fs.unlinkSync to be a no-op for credential files
  fs.unlinkSync = function (filePath) {
    if (
      typeof filePath === "string" &&
      filePath.endsWith(".credentials.json")
    ) {
      if (loggingEnabled) {
        console.log("🚫 Blocked unlinkSync for credentials file:", filePath);
      }
      // No-op - do nothing
      return;
    }

    return originalUnlinkSync.apply(this, arguments);
  };

  // Hook fs.chmodSync to be a no-op for credential files
  fs.chmodSync = function (filePath, mode) {
    if (
      typeof filePath === "string" &&
      filePath.endsWith(".credentials.json")
    ) {
      if (loggingEnabled) {
        console.log("🚫 Blocked chmodSync for credentials file:", filePath);
      }
      // No-op - do nothing
      return;
    }

    return originalChmodSync.apply(this, arguments);
  };
}

// Preload script loaded - no console.log to avoid contaminating Claude Code's JSON output

if (loggingEnabled) {
  console.log(
    "[PRELOAD] Script loaded with platform support:",
    process.platform
  );
}
