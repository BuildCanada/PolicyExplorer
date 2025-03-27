import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } from '@google/generative-ai';
import { VectorSearchService } from '../services/vectorSearchService';
import dotenv from 'dotenv';
import { PartyRepository } from '../database/repository';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

// Initialize Gemini
const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize vector search service
const vectorSearch = new VectorSearchService();
const partyRepo = new PartyRepository();

interface ChatOptions {
  compareParties?: boolean;
  specificParties?: string[];
  limit?: number;
  minSimilarity?: number;
}

class PolicyChatbot {
  private model = googleAI.getGenerativeModel({ 
    model: 'gemini-1.5-pro',
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      }
    ],
  });
  private chat = this.model.startChat({
    history: [
      {
        role: 'user',
        parts: [{
          text: `You are a Canadian politics expert who analyzes Liberal and Conservative party policies. 
                  Your purpose is to answer questions about the policies and positions of these two major Canadian political parties 
                  based ONLY on the information provided to you in each query. 
                  If the information provided does not answer the question, or if a party has not stated a position, 
                  clearly state that you don't have that information.
                  Always include citations to the source where information came from.
                  Never make up or infer policy positions that aren't explicitly supported by the provided content.
                  When comparing parties, be objective and present each party's position fairly.`
        }],
      },
      {
        role: 'model',
        parts: [{
          text: `I understand my role as a Canadian politics expert focusing only on analyzing the policy positions 
                 of the Liberal and Conservative parties based strictly on the information provided in each query.
                 
                 I will:
                 - Answer questions using ONLY the information you provide with each query
                 - Clearly state when I don't have information on a particular policy or party position
                 - Include citations to sources
                 - Never make up or infer policy positions not explicitly supported by the provided content
                 - Present each party's position objectively and fairly when making comparisons
                 
                 I'll wait for your questions about these parties' policies and will analyze the information you provide.`
        }],
      },
    ],
  });

  /**
   * Get relevant policy content based on a query
   */
  private async getRelevantPolicies(query: string, options: ChatOptions = {}): Promise<string> {
    // Convert party names to IDs if specific parties are requested
    let partyIds: number[] = [];
    
    if (options.specificParties && options.specificParties.length > 0) {
      const parties = await partyRepo.getAllParties();
      
      partyIds = parties
        .filter(party => 
          options.specificParties!.some(name => 
            party.name.toLowerCase().includes(name.toLowerCase()) || 
            (party.abbreviation && party.abbreviation.toLowerCase() === name.toLowerCase())
          )
        )
        .map(party => party.id!)
        .filter(id => id !== undefined);
    }
    
    // Search for relevant content
    const searchResults = await vectorSearch.search(query, {
      limit: options.limit || 15,
      minSimilarity: options.minSimilarity || 0.7,
      partyIds: partyIds.length > 0 ? partyIds : undefined
    });
    
    if (searchResults.length === 0) {
      return "No relevant policy information found for this query.";
    }
    
    // Group results by party
    const groupedResults = vectorSearch.groupResultsByParty(searchResults);
    
    // Format results for the LLM
    let context = `I found the following relevant policy information from Canadian political parties:\n\n`;
    
    for (const [partyName, texts] of Object.entries(groupedResults)) {
      context += `## ${partyName} Position\n`;
      
      texts.forEach((text, index) => {
        const result = searchResults.find(r => r.party_name === partyName && r.chunk_text === text);
        if (result) {
          context += `Source: "${result.title}" (${result.url})\n`;
          context += `${text}\n\n`;
        }
      });
    }
    
    return context;
  }

  /**
   * Ask a question about party policies
   */
  async ask(question: string, options: ChatOptions = {}): Promise<string> {
    try {
      // Get relevant policy information
      const policyInfo = await this.getRelevantPolicies(question, options);
      
      // Construct the prompt
      let prompt = `Based on the following information, please answer this question: "${question}"\n\n${policyInfo}\n\n`;
      
      if (options.compareParties) {
        prompt += "Please compare the positions of different parties on this issue. If a party's position is not mentioned in the provided information, clearly state that.";
      }
      
      // Get response from LLM
      const result = await this.chat.sendMessage([{text: prompt}]);
      const response = result.response.text();
      
      return response;
    } catch (error: any) {
      console.error('Error asking question:', error);
      return `Error: ${error.message || 'Something went wrong'}`;
    }
  }
}

// Interactive CLI for chat
export async function startPolicyChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const chatbot = new PolicyChatbot();
  
  console.log('\n🇨🇦 Liberal vs Conservative Policy Analyzer 🇨🇦');
  console.log('Ask questions about Liberal and Conservative party policies (type "exit" to quit, "compare" to compare parties)\n');
  
  const askQuestion = () => {
    rl.question('\nYour question: ', async (question) => {
      if (question.toLowerCase() === 'exit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }
      
      const compareParties = question.toLowerCase().includes('compare') || 
                            question.toLowerCase().includes('difference') ||
                            question.toLowerCase().includes('vs') ||
                            question.toLowerCase().includes('versus');
      
      // Extract party names if mentioned - simplified to just Liberal and Conservative
      const partyKeywords = ['liberal', 'conservative'];
      const specificParties = partyKeywords
        .filter(party => question.toLowerCase().includes(party))
        .map(party => {
          switch (party) {
            case 'liberal': return 'Liberal Party of Canada';
            case 'conservative': return 'Conservative Party of Canada';
            default: return '';
          }
        })
        .filter(party => party !== '');
      
      console.log('\nAnalyzing policy information...');
      
      const answer = await chatbot.ask(question, {
        compareParties,
        specificParties: specificParties.length > 0 ? specificParties : undefined
      });
      
      console.log('\n' + answer);
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// If this file is run directly
if (require.main === module) {
  startPolicyChat().catch(error => {
    console.error('Error starting policy chat:', error);
    process.exit(1);
  });
} 