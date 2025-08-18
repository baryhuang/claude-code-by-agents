import { LogIn, LogOut, User, Loader2, Key } from "lucide-react";
import { useState } from "react";
import { useClaudeAuth } from "../../hooks/useClaudeAuth";

export function AuthButton() {
  const { isAuthenticated, session, isLoading, error, signIn, signOut, completeAuth, hasPendingAuth } = useClaudeAuth();
  const [authCode, setAuthCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

  if (isLoading) {
    return (
      <button className="sidebar-button" disabled>
        <Loader2 className="sidebar-button-icon animate-spin" size={16} />
        Loading...
      </button>
    );
  }

  // Handle form submission for auth code
  const handleAuthCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authCode.trim()) {
      await completeAuth(authCode.trim());
      setAuthCode("");
      setShowCodeInput(false);
    }
  };

  if (isAuthenticated && session) {
    return (
      <div className="auth-section">
        {/* User Info */}
        <div className="auth-user-info">
          <div className="auth-user-avatar">
            <User size={16} />
          </div>
          <div className="auth-user-details">
            <div className="auth-user-email">{session.account?.email_address || 'Authenticated'}</div>
            <div className="auth-user-subscription">{session.subscriptionType || 'Claude User'}</div>
          </div>
        </div>
        
        {/* Sign Out Button */}
        <button 
          className="sidebar-button auth-signout"
          onClick={signOut}
          title="Sign out of Claude"
        >
          <LogOut className="sidebar-button-icon" size={16} />
          Sign Out
        </button>
      </div>
    );
  }

  // Show code input if we have pending auth or user clicked to show it
  if (hasPendingAuth || showCodeInput) {
    return (
      <div className="auth-section">
        <div className="auth-help-text" style={{ marginBottom: '8px' }}>
          Enter the authorization code from your browser:
        </div>
        <div className="auth-help-text" style={{ fontSize: '10px', color: 'var(--claude-text-muted)', marginBottom: '8px' }}>
          💡 Copy the entire authorization code from the callback page (format: code#state). Codes expire quickly, so paste immediately.
        </div>
        
        <form onSubmit={handleAuthCodeSubmit} className="auth-code-form">
          <input
            type="text"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Paste code#state from callback page"
            className="auth-code-input"
            autoFocus
          />
          <div className="auth-code-buttons">
            <button 
              type="submit" 
              className="sidebar-button auth-complete"
              disabled={!authCode.trim() || isLoading}
              title="Complete authentication"
            >
              <Key className="sidebar-button-icon" size={16} />
              Complete
            </button>
            <button 
              type="button"
              className="sidebar-button auth-cancel"
              onClick={() => {
                setShowCodeInput(false);
                setAuthCode("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>

        {error && (
          <div className="auth-error">
            <div className="auth-error-text">{error}</div>
            {error.includes('invalid_grant') && (
              <div style={{ marginTop: '4px', fontSize: '10px' }}>
                The authorization code may have expired or been used. 
                <button 
                  type="button"
                  onClick={() => {
                    setShowCodeInput(false);
                    signIn();
                    setShowCodeInput(true);
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--claude-text-accent)', 
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '10px',
                    padding: '0 2px'
                  }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-section">
      {error && (
        <div className="auth-error">
          <div className="auth-error-text">{error}</div>
        </div>
      )}
      
      <button 
        className="sidebar-button auth-signin"
        onClick={signIn}
        title="Sign in with Claude subscription"
      >
        <LogIn className="sidebar-button-icon" size={16} />
        Sign In to Claude
      </button>
      
      <div className="auth-help-text">
        Sign in with your Claude subscription to use authenticated features. Your browser will open for authentication.
      </div>
    </div>
  );
}