'use client';

import React from 'react';
import { Message } from '../types';
import styles from './Chat.module.css';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`${styles.messageContainer} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageContent}>
        <div className={styles.messageBubble}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className={styles.markdown}>
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className={styles.messageTime}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 