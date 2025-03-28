import { Message } from '../types';

// This file contains API client functions that will be used to interact with the OpenAI API via our serverless functions

export async function createThread() {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'createThread' }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create thread');
    }
    
    const data = await response.json();
    return data.threadId;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
}

export async function sendMessage(threadId: string, message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'sendMessage', threadId, message }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    const data = await response.json();
    return data as Message;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function getMessages(threadId: string) {
  try {
    const response = await fetch(`/api/chat?action=getMessages&threadId=${threadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get messages');
    }
    
    const data = await response.json();
    return data.messages as Message[];
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
} 