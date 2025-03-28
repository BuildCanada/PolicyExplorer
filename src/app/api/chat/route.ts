import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use your assistant ID from OpenAI dashboard
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Helper function to safely extract text content
function extractTextContent(content: any) {
  if (!content || !Array.isArray(content)) {
    return "";
  }
  
  return content
    .filter(item => item.type === 'text')
    .map(item => item.text?.value || "")
    .join("\n\n");
}

// Create Thread endpoint
export async function POST(request: NextRequest) {
  if (!ASSISTANT_ID) {
    return NextResponse.json({ error: 'Assistant ID not configured' }, { status: 500 });
  }

  const { action, threadId, message } = await request.json();

  try {
    // Create a new thread
    if (action === 'createThread') {
      const thread = await openai.beta.threads.create();
      return NextResponse.json({ threadId: thread.id });
    } 
    
    // Send a message to the thread
    else if (action === 'sendMessage') {      
      // Add the user message to the thread
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message,
      });
      
      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: ASSISTANT_ID,
      });
      
      // Poll for the run to complete
      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }
      
      if (runStatus.status === 'failed') {
        return NextResponse.json({ error: 'Assistant run failed' }, { status: 500 });
      }
      
      // Get the latest messages
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Return the latest assistant message
      const latestMessage = messages.data
        .filter(msg => msg.role === 'assistant')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      return NextResponse.json({
        id: latestMessage.id,
        role: 'assistant',
        content: extractTextContent(latestMessage.content),
        createdAt: new Date(latestMessage.created_at * 1000),
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}

// Get messages endpoint
export async function GET(request: NextRequest) {
  if (!ASSISTANT_ID) {
    return NextResponse.json({ error: 'Assistant ID not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get('threadId');
  const action = url.searchParams.get('action');

  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
  }

  try {
    if (action === 'getMessages') {
      const messages = await openai.beta.threads.messages.list(threadId);
      
      const formattedMessages = messages.data.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: extractTextContent(msg.content),
        createdAt: new Date(msg.created_at * 1000),
      }));
      
      return NextResponse.json({ messages: formattedMessages });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
} 