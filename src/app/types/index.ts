export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface ThreadData {
  threadId: string | null;
  messages: Message[];
  isLoading: boolean;
} 