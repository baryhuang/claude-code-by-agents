import { createHash, randomBytes } from "crypto";
import { shell, BrowserWindow } from "electron";
import Store from "electron-store";
import { getMainDatabase } from "../database";
import * as fs from "fs";

// Claude OAuth Configuration
const AUTHORIZATION_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const PROFILE_URL = "https://api.anthropic.com/api/oauth/profile";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";

// Default scopes for Claude API
const SCOPES = ["org:create_api_key", "user:profile", "user:inference"];

const EXPIRATION_MARGIN_MINUTES = 60;

export interface ClaudeAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  needsAuth: boolean;
  hasPendingAuth: boolean; // True when waiting for user to enter auth code
  isRefreshing: boolean; // True when performing token refresh
}

export interface ClaudeAuthorizationRequest {
  authUrl: string;
  codeVerifier: string;
  state: string;
  codeChallenge: string;
}

export interface ClaudeSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  scopes: string[];
  userId: string;
  subscriptionType: string | null;
  account?: {
    email_address?: string;
    uuid?: string;
  };
}

export interface SessionAnalysis {
  identityExpired: boolean;
  needsRefresh: boolean;
}

/**
 * ClaudeOAuthService manages Claude OAuth authentication and token refresh
 * for the Claudette Electron app.
 */
export class ClaudeOAuthService {
  private authStore: Store;
  private currentState: ClaudeAuthState;
  private pendingAuth: ClaudeAuthorizationRequest | null = null;

  constructor() {
    this.authStore = new Store({
      name: "claude-credentials",
    });

    // Log store information for debugging
    console.log("[CLAUDE AUTH] Electron store configuration:");
    console.log(`[CLAUDE AUTH] Store path: ${this.authStore.path}`);
    console.log(`[CLAUDE AUTH] Store size: ${this.authStore.size}`);

    this.currentState = {
      isAuthenticated: false,
      isLoading: false,
      error: null,
      needsAuth: false,
      hasPendingAuth: false,
      isRefreshing: false,
    };

    this.initialize();
  }

  /**
   * Set secure file permissions (equivalent to chmod 600) on the credentials file
   */
  private setSecureFilePermissions(): void {
    try {
      const filePath = this.authStore.path;
      if (fs.existsSync(filePath)) {
        fs.chmodSync(filePath, 0o600); // Read/write for owner only
        console.log(
          `[CLAUDE AUTH] Set secure permissions (600) on: ${filePath}`
        );
      }
    } catch (error) {
      console.error(
        "[CLAUDE AUTH] Failed to set secure file permissions:",
        error
      );
    }
  }

  /**
   * Initialize the service and check existing auth state
   */
  private async initialize() {
    try {
      console.log("[CLAUDE AUTH] Initializing Claude OAuth service...");
      await this.loadAuthState();
      console.log(
        "[CLAUDE AUTH] Claude OAuth service initialized successfully"
      );
    } catch (error) {
      console.error("[CLAUDE AUTH] Initialization failed:", error);
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: "Failed to initialize Claude authentication service",
        needsAuth: true,
        hasPendingAuth: false,
        isRefreshing: false,
      });
    }
  }

  /**
   * Load existing auth state from electron-store
   */
  private async loadAuthState() {
    console.log("[CLAUDE AUTH] Loading auth state...");
    console.log(
      `[CLAUDE AUTH] Loading from store path: ${this.authStore.path}`
    );

    const session = this.authStore.get("claudeAiOauth") as
      | ClaudeSession
      | undefined;

    if (!session) {
      console.log("[CLAUDE AUTH] No existing session found");
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        needsAuth: true,
        hasPendingAuth: false,
        isRefreshing: false,
      });
      return;
    }

    console.log("[CLAUDE AUTH] Existing session found:");
    console.log(
      `[CLAUDE AUTH] Loaded refresh token: ${session.refreshToken?.substring(
        0,
        10
      )}...${session.refreshToken?.substring(
        session.refreshToken.length - 10
      )} (length: ${session.refreshToken?.length})`
    );
    console.log(
      `[CLAUDE AUTH] Session expires at: ${new Date(
        session.expiresAt
      ).toISOString()}`
    );
    console.log(`[CLAUDE AUTH] Current time: ${new Date().toISOString()}`);
    console.log(
      `[CLAUDE AUTH] Time until expiry: ${Math.round(
        (session.expiresAt - Date.now()) / 1000 / 60
      )} minutes`
    );

    try {
      // Check if session needs refresh
      const analysis = this.analyzeSession(session);
      console.log("[CLAUDE AUTH] Session analysis:", analysis);

      if (analysis.needsRefresh) {
        console.log("[CLAUDE AUTH] Session needs refresh");
        // Set refreshing state to prevent UI flash
        this.updateState({
          isRefreshing: true,
        });
        
        const refreshResult = await this.refreshSession(session);

        if (refreshResult.success) {
          this.updateState({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            needsAuth: false,
            hasPendingAuth: false,
            isRefreshing: false,
          });
        } else {
          console.log(
            "[CLAUDE AUTH] Session refresh failed, need to re-authenticate"
          );
          this.updateState({
            isAuthenticated: false,
            isLoading: false,
            error: "Authentication expired. Please sign in again.",
            needsAuth: true,
            hasPendingAuth: false,
            isRefreshing: false,
          });
        }
      } else {
        console.log("[CLAUDE AUTH] Session is valid");
        this.updateState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
          needsAuth: false,
          hasPendingAuth: false,
          isRefreshing: false,
        });
      }
    } catch (error) {
      console.error("[CLAUDE AUTH] Error analyzing session:", error);
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: "Failed to validate existing session",
        needsAuth: true,
        hasPendingAuth: false,
        isRefreshing: false,
      });
    }
  }

  /**
   * Generate a cryptographically secure random string
   */
  private generateSecureRandom(length = 32): string {
    return randomBytes(length).toString("base64url");
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return createHash("sha256").update(codeVerifier).digest("base64url");
  }

  /**
   * Check if a token is expired or close to expiring
   */
  private isTokenExpired(
    expiresAt: number,
    marginMinutes = EXPIRATION_MARGIN_MINUTES
  ): boolean {
    if (!expiresAt) return true;

    const marginMs = marginMinutes * 60 * 1000;
    const now = Date.now();

    return now + marginMs >= expiresAt;
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  private generateAuthorizationUrl(
    scopes: string[] = SCOPES
  ): ClaudeAuthorizationRequest {
    const codeVerifier = this.generateSecureRandom(32);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateSecureRandom(32);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: scopes.join(" "),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${AUTHORIZATION_URL}?${params.toString()}`;

    return {
      authUrl,
      codeVerifier,
      state,
      codeChallenge,
    };
  }

  /**
   * Parse authorization code and state from user input
   */
  private parseCodeAndState(
    codeInput: string,
    expectedState?: string
  ): { code: string; state: string } {
    // Check if the input contains the hash format: code#state
    if (codeInput.includes("#")) {
      const [code, state] = codeInput.split("#");

      if (!code || !state) {
        throw new Error(
          "Invalid code#state format. Expected format: 'authorizationCode#stateValue'"
        );
      }

      if (expectedState && state !== expectedState) {
        throw new Error("State parameter mismatch - possible CSRF attack");
      }

      return { code, state };
    }

    throw new Error(
      "Authorization code must be in 'code#state' format from Claude callback page"
    );
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(
    authorizationCode: string,
    state: string,
    codeVerifier: string
  ): Promise<any> {
    const payload = {
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
      state: state,
    };

    console.log("[CLAUDE AUTH] Exchanging authorization code for tokens...");

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude token exchange failed: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[CLAUDE AUTH] Token exchange successful!", data);

    return data;
  }

  /**
   * Refresh identity token using refresh token
   */
  private async refreshIdentityToken(refreshToken: string): Promise<any> {
    console.log("[CLAUDE AUTH] Refreshing identity token...");

    // Log refresh token info (safely - only show first 10 and last 10 characters)
    const tokenPreview = refreshToken
      ? `${refreshToken.substring(0, 10)}...${refreshToken.substring(
          refreshToken.length - 10
        )}`
      : "null";
    console.log(
      `[CLAUDE AUTH] Using refresh token: ${tokenPreview} (length: ${
        refreshToken?.length || 0
      })`
    );

    const payload = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    };

    console.log("[CLAUDE AUTH] Token refresh payload:", {
      grant_type: payload.grant_type,
      client_id: payload.client_id,
      refresh_token: tokenPreview, // Log the preview instead of full token
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `[CLAUDE AUTH] Token refresh response status: ${response.status} ${response.statusText}`
    );
    console.log(
      `[CLAUDE AUTH] Token refresh response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[CLAUDE AUTH] Token refresh failed with status ${response.status}:`
      );
      console.error(`[CLAUDE AUTH] Error response body:`, errorText);
      throw new Error(
        `Claude identity token refresh failed: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[CLAUDE AUTH] Identity token refreshed!");
    console.log("[CLAUDE AUTH] New token data received:", {
      access_token: data.access_token
        ? `${data.access_token.substring(0, 20)}...`
        : "null",
      refresh_token: data.refresh_token
        ? `${data.refresh_token.substring(0, 20)}...`
        : "null",
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type,
    });

    // Get updated profile with new access token
    const profile = await this.getProfile(data.access_token);
    console.log("[CLAUDE AUTH] Profile refreshed:", profile);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
      expiresAt: Date.now() + data.expires_in * 1000, // Unix timestamp
      scopes: data.scope ? data.scope.split(" ") : SCOPES,
      userId: data.account?.uuid || "unknown",
      subscriptionType: this.getSubscriptionType(profile),
      account: data.account || null,
    };
  }

  /**
   * Get user profile using access token
   */
  private async getProfile(accessToken: string): Promise<any> {
    console.log("[CLAUDE AUTH] Getting user profile...");

    const response = await fetch(PROFILE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude profile fetch failed: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    console.log("[CLAUDE AUTH] Profile fetched successfully");

    return data;
  }

  /**
   * Determine subscription type from profile data
   */
  private getSubscriptionType(profile: any): string | null {
    const organizationType = profile?.organization?.organization_type;

    switch (organizationType) {
      case "claude_max":
        return "max";
      case "claude_pro":
        return "pro";
      case "claude_enterprise":
        return "enterprise";
      case "claude_team":
        return "team";
      default:
        return null;
    }
  }

  /**
   * Save subscription type to database settings
   */
  private async saveSubscriptionTypeToSettings(
    subscriptionType: string | null
  ): Promise<void> {
    try {
      const database = getMainDatabase();
      const now = new Date().toISOString();

      const existingSettings = await database.settings
        .findOne("global-settings")
        .exec();

      if (existingSettings) {
        await existingSettings.update({
          $set: {
            subscriptionType: subscriptionType,
            updatedAt: now,
          },
        });
      } else {
        await database.settings.insert({
          id: "global-settings",
          keyboardMode: "enter-to-send",
          themeSource: "system",
          claudeBillingMode: "oauth",
          subscriptionType: subscriptionType,
          updatedAt: now,
        });
      }

      console.log(
        `[CLAUDE AUTH] Subscription type saved to settings: ${subscriptionType}`
      );
    } catch (error) {
      console.error(
        "[CLAUDE AUTH] Failed to save subscription type to settings:",
        error
      );
    }
  }

  /**
   * Build the complete session object from token data
   */
  private buildSession(tokenData: any, profile?: any): ClaudeSession {
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000, // Unix timestamp
      scopes: tokenData.scope ? tokenData.scope.split(" ") : SCOPES,
      userId: tokenData.account?.uuid || "unknown",
      subscriptionType: profile ? this.getSubscriptionType(profile) : null,
      account: tokenData.account || undefined,
    };
  }

  /**
   * Analyze session to determine if refresh is needed
   */
  private analyzeSession(session: ClaudeSession): SessionAnalysis {
    if (!session) {
      throw new Error("No session provided for analysis");
    }

    // Check if token is expired
    const identityExpired = this.isTokenExpired(session.expiresAt);

    return {
      identityExpired,
      needsRefresh: identityExpired,
    };
  }

  /**
   * Refresh existing session
   */
  private async refreshSession(session: ClaudeSession): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log("[CLAUDE AUTH] Refreshing session...");
      console.log(
        `[CLAUDE AUTH] Current session refresh token: ${session.refreshToken?.substring(
          0,
          10
        )}...${session.refreshToken?.substring(
          session.refreshToken.length - 10
        )} (length: ${session.refreshToken?.length})`
      );

      const newTokenData = await this.refreshIdentityToken(
        session.refreshToken
      );

      const updatedSession: ClaudeSession = {
        accessToken: newTokenData.accessToken,
        refreshToken: newTokenData.refreshToken,
        expiresAt: newTokenData.expiresAt,
        scopes: newTokenData.scopes,
        userId: newTokenData.userId,
        subscriptionType: newTokenData.subscriptionType,
        account: newTokenData.account,
      };

      console.log("[CLAUDE AUTH] About to save updated session to store...");
      console.log(
        `[CLAUDE AUTH] New refresh token: ${updatedSession.refreshToken?.substring(
          0,
          10
        )}...${updatedSession.refreshToken?.substring(
          updatedSession.refreshToken.length - 10
        )} (length: ${updatedSession.refreshToken?.length})`
      );
      console.log(`[CLAUDE AUTH] Store path: ${this.authStore.path}`);

      // Save updated session
      this.authStore.set("claudeAiOauth", updatedSession);

      // Set secure file permissions (chmod 600 equivalent)
      this.setSecureFilePermissions();

      // Save subscription type to database settings
      await this.saveSubscriptionTypeToSettings(
        updatedSession.subscriptionType
      );

      // Verify the save was successful by reading it back
      const savedSession = this.authStore.get("claudeAiOauth") as ClaudeSession;
      console.log("[CLAUDE AUTH] Session saved successfully to store");
      console.log(
        `[CLAUDE AUTH] Verified saved refresh token: ${savedSession.refreshToken?.substring(
          0,
          10
        )}...${savedSession.refreshToken?.substring(
          savedSession.refreshToken.length - 10
        )} (length: ${savedSession.refreshToken?.length})`
      );
      console.log(
        `[CLAUDE AUTH] Store size after save: ${this.authStore.size}`
      );

      console.log("[CLAUDE AUTH] Session refresh completed successfully");
      return { success: true };
    } catch (error) {
      console.error("[CLAUDE AUTH] Session refresh failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Session refresh failed",
      };
    }
  }

  /**
   * Update auth state and notify renderer
   */
  private updateState(newState: Partial<ClaudeAuthState>) {
    const previousState = this.currentState;
    this.currentState = { ...this.currentState, ...newState };
    console.log("[CLAUDE AUTH] State updated:", this.currentState);

    // Emit auth state change to all renderer processes
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      if (window.webContents) {
        window.webContents.send("claude-auth-state-changed", this.currentState);
      }
    });

    // If we just became authenticated, notify task runner to retry pending tasks
    if (!previousState.isAuthenticated && this.currentState.isAuthenticated) {
      console.log(
        "[CLAUDE AUTH] Authentication successful - notifying task runner to retry pending tasks"
      );
      // Import and notify task runner service
      import("./task-runner/task-runner.service")
        .then(({ taskRunnerService }) => {
          if (taskRunnerService) {
            taskRunnerService.onClaudeAuthChanged();
          }
        })
        .catch((error) => {
          console.error("[CLAUDE AUTH] Failed to notify task runner:", error);
        });
    }
  }

  /**
   * Start authentication flow
   */
  public async startAuthentication(): Promise<ClaudeAuthorizationRequest> {
    console.log("[CLAUDE AUTH] Starting authentication flow...");

    this.updateState({
      isLoading: true,
      error: null,
    });

    try {
      // Generate authorization URL with PKCE
      const authRequest = this.generateAuthorizationUrl(SCOPES);

      // Store pending auth request
      this.pendingAuth = authRequest;

      this.updateState({
        isLoading: false,
        needsAuth: true,
        hasPendingAuth: true, // User needs to enter auth code
        isRefreshing: false,
      });

      console.log("[CLAUDE AUTH] Authentication flow started");
      return authRequest;
    } catch (error) {
      console.error("[CLAUDE AUTH] Failed to start authentication:", error);
      this.updateState({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start authentication",
        hasPendingAuth: false,
        isRefreshing: false,
      });
      throw error;
    }
  }

  /**
   * Open authentication URL in browser
   */
  public async openAuthUrl(): Promise<boolean> {
    try {
      if (!this.pendingAuth) {
        await this.startAuthentication();
      }

      if (this.pendingAuth) {
        console.log("[CLAUDE AUTH] Opening authentication URL in browser...");
        await shell.openExternal(this.pendingAuth.authUrl);
        return true;
      }

      return false;
    } catch (error) {
      console.error("[CLAUDE AUTH] Failed to open auth URL:", error);
      return false;
    }
  }

  /**
   * Complete authentication using the provided code#state
   */
  public async completeAuthentication(codeStateInput: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.log("[CLAUDE AUTH] Completing authentication...");

    if (!this.pendingAuth) {
      return {
        success: false,
        error: "No pending authentication request found",
      };
    }

    this.updateState({
      isLoading: true,
      error: null,
    });

    try {
      // Parse code and state from user input
      const { code, state } = this.parseCodeAndState(
        codeStateInput,
        this.pendingAuth.state
      );

      // Exchange code for tokens
      const tokenData = await this.exchangeCodeForTokens(
        code,
        state,
        this.pendingAuth.codeVerifier
      );

      // Get profile
      const profile = await this.getProfile(tokenData.access_token);
      console.log("[CLAUDE AUTH] Profile:", profile);

      // Build session
      const session = this.buildSession(tokenData, profile);

      // Save session
      this.authStore.set("claudeAiOauth", session);

      // Set secure file permissions (chmod 600 equivalent)
      this.setSecureFilePermissions();

      // Save subscription type to database settings
      await this.saveSubscriptionTypeToSettings(session.subscriptionType);

      // Clear pending auth
      this.pendingAuth = null;

      this.updateState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        needsAuth: false,
        hasPendingAuth: false,
        isRefreshing: false,
      });

      console.log("[CLAUDE AUTH] Authentication completed successfully");
      return { success: true };
    } catch (error) {
      console.error("[CLAUDE AUTH] Authentication failed:", error);
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Authentication failed",
        needsAuth: true,
        hasPendingAuth: false, // Clear pending auth on error
        isRefreshing: false,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Get current auth state
   */
  public getState(): ClaudeAuthState {
    return { ...this.currentState };
  }

  /**
   * Get valid access token (refresh if needed)
   */
  public async getValidAccessToken(): Promise<string | null> {
    console.log("[CLAUDE AUTH] Getting valid access token...");

    const session = this.authStore.get("claudeAiOauth") as
      | ClaudeSession
      | undefined;

    if (!session) {
      console.log("[CLAUDE AUTH] No session found");
      this.updateState({
        isAuthenticated: false,
        needsAuth: true,
        error: null, // Don't show error for missing session - it's a normal state
        hasPendingAuth: false,
        isRefreshing: false,
      });
      return null;
    }

    try {
      // Check if session needs refresh
      const analysis = this.analyzeSession(session);

      if (analysis.needsRefresh) {
        console.log("[CLAUDE AUTH] Token needs refresh");
        // Set refreshing state to prevent UI flash
        this.updateState({
          isRefreshing: true,
        });
        
        const refreshResult = await this.refreshSession(session);

        if (refreshResult.success) {
          const updatedSession = this.authStore.get(
            "claudeAiOauth"
          ) as ClaudeSession;
          this.updateState({
            isAuthenticated: true,
            needsAuth: false,
            error: null,
            hasPendingAuth: false,
            isRefreshing: false,
          });
          return updatedSession.accessToken;
        } else {
          console.log("[CLAUDE AUTH] Token refresh failed");
          this.updateState({
            isAuthenticated: false,
            needsAuth: true,
            error: "Authentication expired. Please sign in again.",
            hasPendingAuth: false,
            isRefreshing: false,
          });
          return null;
        }
      }

      console.log("[CLAUDE AUTH] Token is valid");
      this.updateState({
        isAuthenticated: true,
        needsAuth: false,
        error: null,
        hasPendingAuth: false,
        isRefreshing: false,
      });
      return session.accessToken;
    } catch (error) {
      console.error("[CLAUDE AUTH] Error getting valid token:", error);
      this.updateState({
        isAuthenticated: false,
        needsAuth: true,
        error: "Failed to validate authentication",
        hasPendingAuth: false,
        isRefreshing: false,
      });
      return null;
    }
  }

  /**
   * Sign out and clear stored session
   */
  public async signOut(): Promise<void> {
    console.log("[CLAUDE AUTH] Signing out...");

    this.authStore.delete("claudeAiOauth");
    this.pendingAuth = null;

    this.updateState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      needsAuth: true,
      hasPendingAuth: false,
      isRefreshing: false,
    });

    console.log("[CLAUDE AUTH] Sign out completed");
  }

  /**
   * Get session from store for external use
   */
  public getSessionFromStore(): ClaudeSession | null {
    const session = this.authStore.get("claudeAiOauth") as ClaudeSession | undefined;
    return session || null;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    console.log("[CLAUDE AUTH] Cleaning up...");
    this.pendingAuth = null;
  }
}

// Singleton instance
let claudeOAuthService: ClaudeOAuthService | null = null;

/**
 * Get the singleton Claude OAuth service instance
 */
export const getClaudeOAuthService = (): ClaudeOAuthService => {
  if (!claudeOAuthService) {
    claudeOAuthService = new ClaudeOAuthService();
  }
  return claudeOAuthService;
};
