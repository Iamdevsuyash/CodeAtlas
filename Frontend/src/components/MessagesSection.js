
import React from 'react';

const MessagesSection = () => {
  return (
    <div id="messages-content" className="section-content">
      <div className="messages-layout">
        <div className="conversations-list">
          <div className="conversation-item active">
            <div className="conversation-avatar">
              <div className="unread-indicator"></div>
              SA
            </div>
            <div className="conversation-info">
              <div className="conversation-name">Sarah Chen</div>
              <div className="conversation-preview">Hey! Interested in your React project...</div>
              <div className="conversation-time">2:30 PM</div>
            </div>
          </div>
        </div>
        <div className="chat-area">
          <div className="chat-header">
            <div className="conversation-avatar">SA</div>
            <div>
              <div className="conversation-name">Sarah Chen</div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                Business Analyst • Online
              </div>
            </div>
          </div>
          <div className="chat-messages">
            <div className="message">
              <div className="message-avatar">SA</div>
              <div>
                <div className="message-content">
                  Hey John! I saw your React dashboard project. I have some market research data that could be really
                  valuable for this.
                </div>
                <div className="message-time">2:25 PM</div>
              </div>
            </div>
          </div>
          <div className="chat-input-area">
            <textarea className="chat-input" placeholder="Type a message..." rows="1"></textarea>
            <button className="send-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M15.854.146a.5.5 0 0 1 .11.54L13.026 8l2.938 7.314a.5.5 0 0 1-.538.654l-14-3.5a.5.5 0 0 1-.128-.861L8 8 1.298 4.393a.5.5 0 0 1 .128-.861l14-3.5a.5.5 0 0 1 .428.014z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesSection; 