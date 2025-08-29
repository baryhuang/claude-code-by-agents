import { useEffect, useCallback, useRef } from 'react';
import type { AllMessage } from '../types';

interface MessagePersistenceOptions {
  sessionId: string | null;
  agentId?: string;
  messages: AllMessage[];
  onMessagesLoaded?: (messages: AllMessage[]) => void;
}

export function useMessagePersistence({
  sessionId,
  agentId = 'default',
  messages,
  onMessagesLoaded
}: MessagePersistenceOptions) {
  const isElectron = window.electronAPI?.storage;
  const hasLoadedRef = useRef(false);
  const lastSavedMessagesRef = useRef<AllMessage[]>([]);

  // Load messages when session starts or when session ID changes
  useEffect(() => {
    if (!isElectron || !sessionId) {
      return;
    }

    // Reset loading state when session changes
    hasLoadedRef.current = false;

    console.log('🔄 Loading conversation from Electron storage:', sessionId);
    
    window.electronAPI!.storage.loadConversation(sessionId)
      .then((result) => {
        if (result.success && result.data && result.data.messages && result.data.messages.length > 0) {
          console.log('📖 Loaded messages from storage:', result.data.messages.length);
          
          // Convert stored messages back to proper format
          const loadedMessages = result.data.messages.map((msg: any) => ({
            ...msg,
            timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp // Convert to number timestamp
          }));
          
          onMessagesLoaded?.(loadedMessages);
          hasLoadedRef.current = true;
        } else {
          console.log('📝 No existing conversation found for session:', sessionId);
          hasLoadedRef.current = true;
        }
      })
      .catch((error) => {
        console.error('❌ Failed to load conversation:', error);
        hasLoadedRef.current = true;
      });
  }, [sessionId, isElectron, onMessagesLoaded]);

  // Save messages when they change
  const saveMessages = useCallback(() => {
    console.log('🔍 saveMessages called:', {
      isElectron: !!isElectron,
      sessionId,
      messageCount: messages.length,
      agentId
    });

    if (!isElectron || !sessionId || messages.length === 0) {
      console.log('⏭️ Skipping save:', {
        reason: !isElectron ? 'not electron' : !sessionId ? 'no session' : 'no messages'
      });
      return;
    }

    // Check if messages have actually changed to avoid unnecessary saves
    const messagesStringified = JSON.stringify(messages);
    const lastSavedStringified = JSON.stringify(lastSavedMessagesRef.current);
    
    if (messagesStringified === lastSavedStringified) {
      console.log('⏭️ Skipping save: messages unchanged');
      return;
    }

    console.log('💾 Saving conversation to Electron storage:', {
      sessionId,
      messageCount: messages.length,
      agentId,
      lastSavedCount: lastSavedMessagesRef.current.length
    });

    // Create conversation data with metadata
    const conversationData = {
      sessionId,
      agentId,
      messages: messages.map(msg => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number' ? new Date(msg.timestamp).toISOString() : msg.timestamp // Convert number timestamp to ISO string for storage
      })),
      lastUpdated: new Date().toISOString(),
      messageCount: messages.length
    };

    window.electronAPI!.storage.saveConversation(sessionId, conversationData.messages)
      .then((result) => {
        if (result.success) {
          console.log('✅ Successfully saved conversation');
          lastSavedMessagesRef.current = [...messages];
        } else {
          console.error('❌ Failed to save conversation:', result.error);
        }
      })
      .catch((error) => {
        console.error('❌ Failed to save conversation:', error);
      });
  }, [isElectron, sessionId, messages, agentId]);

  // Auto-save messages when they change (debounced)
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    // Only save if we have a session ID and this is Electron
    if (!isElectron || !sessionId) {
      return;
    }

    console.log('🔄 Messages changed, scheduling save...', { 
      messageCount: messages.length, 
      sessionId,
      hasLoaded: hasLoadedRef.current 
    });

    const saveTimeout = setTimeout(() => {
      saveMessages();
    }, 1000); // Debounce saves by 1 second

    return () => clearTimeout(saveTimeout);
  }, [messages, saveMessages, isElectron, sessionId]);

  // Don't need separate reset effect since we handle it in the load effect

  // List all conversations
  const listConversations = useCallback(async () => {
    if (!isElectron) {
      return [];
    }

    try {
      const result = await window.electronAPI!.storage.listConversations();
      if (result.success) {
        return result.data || [];
      } else {
        console.error('❌ Failed to list conversations:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to list conversations:', error);
      return [];
    }
  }, [isElectron]);

  // Load specific conversation
  const loadConversation = useCallback(async (targetSessionId: string) => {
    if (!isElectron) {
      return null;
    }

    try {
      const result = await window.electronAPI!.storage.loadConversation(targetSessionId);
      if (result.success && result.data) {
        // Convert stored messages back to proper format
        const loadedMessages = result.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp
        }));
        
        return {
          sessionId: targetSessionId,
          messages: loadedMessages,
          metadata: {
            lastUpdated: result.data.lastUpdated,
            messageCount: result.data.messages.length
          }
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      return null;
    }
  }, [isElectron]);

  // Manual save function
  const saveNow = useCallback(() => {
    saveMessages();
  }, [saveMessages]);

  // Clear conversation
  const clearConversation = useCallback(async (targetSessionId?: string) => {
    const sessionToClear = targetSessionId || sessionId;
    if (!isElectron || !sessionToClear) {
      return;
    }

    try {
      // Save empty conversation to effectively clear it
      const result = await window.electronAPI!.storage.saveConversation(sessionToClear, []);
      if (result.success) {
        console.log('🗑️ Cleared conversation:', sessionToClear);
        if (sessionToClear === sessionId) {
          lastSavedMessagesRef.current = [];
        }
      }
    } catch (error) {
      console.error('❌ Failed to clear conversation:', error);
    }
  }, [isElectron, sessionId]);

  return {
    // Status
    isElectron,
    hasLoaded: hasLoadedRef.current,
    
    // Actions
    saveNow,
    listConversations,
    loadConversation,
    clearConversation
  };
}