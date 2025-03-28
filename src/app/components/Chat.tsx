'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, ThreadData } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { createThread, sendMessage, getMessages } from '../lib/api';
import styles from './Chat.module.css';

const Chat: React.FC = () => {
  const [threadData, setThreadData] = useState<ThreadData>({
    threadId: null,
    messages: [],
    isLoading: false,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeThread = async () => {
      try {
        const threadId = await createThread();
        setThreadData(prevState => ({
          ...prevState,
          threadId,
        }));
      } catch (error) {
        console.error('Failed to initialize thread:', error);
      }
    };

    initializeThread();
  }, []);

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadData.messages]);

  const handleSendMessage = async (content: string) => {
    if (!threadData.threadId) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setThreadData(prevState => ({
      ...prevState,
      messages: [...prevState.messages, userMessage],
      isLoading: true,
    }));

    try {
      // Send message to API
      const assistantMessage = await sendMessage(threadData.threadId, content);
      
      // Update with assistant response
      setThreadData(prevState => ({
        ...prevState,
        messages: [...prevState.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      setThreadData(prevState => ({
        ...prevState,
        isLoading: false,
      }));
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        {/* Chat header content removed */}
      </div>
      
      <div className={styles.messagesContainer}>
        {threadData.messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Send a message to start exploring policy information.</p>
          </div>
        ) : (
          threadData.messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        
        {threadData.isLoading && (
          <div className={styles.loadingIndicator}>
            <p>Processing your request...</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <ChatInput 
        onSendMessage={handleSendMessage} 
        disabled={threadData.isLoading || !threadData.threadId} 
      />
    </div>
  );
};

export default Chat; 