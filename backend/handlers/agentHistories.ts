import { Context } from "hono";
import type { HistoryListResponse } from "../../shared/types.ts";
import { validateEncodedProjectName } from "../history/pathUtils.ts";
import { parseAllHistoryFiles } from "../history/parser.ts";
import { groupConversations } from "../history/grouping.ts";

/**
 * Handles GET /api/agent-histories/:encodedProjectName requests
 * Fetches conversation history list for a specific project from agent endpoint
 * @param c - Hono context object with config variables
 * @returns JSON response with conversation history list
 */
export async function handleAgentHistoriesRequest(c: Context) {
  try {
    const { debugMode, runtime } = c.var.config;
    const encodedProjectName = c.req.param("encodedProjectName");
    const agentId = c.req.query("agentId"); // Get agent ID from query parameter

    if (!encodedProjectName) {
      return c.json({ error: "Encoded project name is required" }, 400);
    }

    if (!validateEncodedProjectName(encodedProjectName)) {
      return c.json({ error: "Invalid encoded project name" }, 400);
    }

    if (debugMode) {
      console.debug(
        `[DEBUG] Fetching agent histories for encoded project: ${encodedProjectName}`,
      );
    }

    // Get home directory
    const homeDir = runtime.getHomeDir();
    if (!homeDir) {
      return c.json({ error: "Home directory not found" }, 500);
    }

    // Build history directory path directly from encoded name
    const historyDir = `${homeDir}/.claude/projects/${encodedProjectName}`;

    if (debugMode) {
      console.debug(`[DEBUG] Agent history directory: ${historyDir}`);
    }

    // Check if the directory exists
    try {
      const dirInfo = await runtime.stat(historyDir);
      if (!dirInfo.isDirectory) {
        return c.json({ error: "Project not found" }, 404);
      }
    } catch (error) {
      // Handle file not found errors in a cross-platform way
      if (error instanceof Error && error.message.includes("No such file")) {
        return c.json({ error: "Project not found" }, 404);
      }
      throw error;
    }

    const conversationFiles = await parseAllHistoryFiles(historyDir, runtime);

    if (debugMode) {
      console.debug(
        `[DEBUG] Found ${conversationFiles.length} agent conversation files`,
      );
    }

    // Group conversations and remove duplicates
    const groupedConversations = groupConversations(conversationFiles);

    // Filter conversations by agent ID if provided
    let filteredConversations = groupedConversations;
    if (agentId) {
      filteredConversations = groupedConversations.filter(conversation => {
        // Find the corresponding conversation file to check agent ID
        const conversationFile = conversationFiles.find(file => 
          file.sessionId === conversation.sessionId
        );
        return conversationFile?.agentId === agentId;
      });

      if (debugMode) {
        console.debug(
          `[DEBUG] Filtered to ${filteredConversations.length} conversations for agent: ${agentId}`,
        );
      }
    }

    // Add agent ID to the conversation summaries
    const conversationsWithAgentId = filteredConversations.map(conversation => {
      const conversationFile = conversationFiles.find(file => 
        file.sessionId === conversation.sessionId
      );
      return {
        ...conversation,
        agentId: conversationFile?.agentId
      };
    });

    if (debugMode) {
      console.debug(
        `[DEBUG] After grouping and filtering: ${conversationsWithAgentId.length} unique agent conversations`,
      );
    }

    const response: HistoryListResponse = {
      conversations: conversationsWithAgentId,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error fetching agent conversation histories:", error);

    return c.json(
      {
        error: "Failed to fetch agent conversation histories",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}