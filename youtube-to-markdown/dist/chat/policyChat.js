"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPolicyChat = startPolicyChat;
const generative_ai_1 = require("@google/generative-ai");
const vectorSearchService_1 = require("../services/vectorSearchService");
const dotenv_1 = __importDefault(require("dotenv"));
const repository_1 = require("../database/repository");
const readline = __importStar(require("readline"));
// Load environment variables
dotenv_1.default.config();
// Initialize Gemini
const googleAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Initialize vector search service
const vectorSearch = new vectorSearchService_1.VectorSearchService();
const partyRepo = new repository_1.PartyRepository();
class PolicyChatbot {
    constructor() {
        this.model = googleAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            ],
        });
        this.chat = this.model.startChat({
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
    }
    /**
     * Get relevant policy content based on a query
     */
    getRelevantPolicies(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            // Convert party names to IDs if specific parties are requested
            let partyIds = [];
            if (options.specificParties && options.specificParties.length > 0) {
                const parties = yield partyRepo.getAllParties();
                partyIds = parties
                    .filter(party => options.specificParties.some(name => party.name.toLowerCase().includes(name.toLowerCase()) ||
                    (party.abbreviation && party.abbreviation.toLowerCase() === name.toLowerCase())))
                    .map(party => party.id)
                    .filter(id => id !== undefined);
            }
            // Search for relevant content
            const searchResults = yield vectorSearch.search(query, {
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
        });
    }
    /**
     * Ask a question about party policies
     */
    ask(question_1) {
        return __awaiter(this, arguments, void 0, function* (question, options = {}) {
            try {
                // Get relevant policy information
                const policyInfo = yield this.getRelevantPolicies(question, options);
                // Construct the prompt
                let prompt = `Based on the following information, please answer this question: "${question}"\n\n${policyInfo}\n\n`;
                if (options.compareParties) {
                    prompt += "Please compare the positions of different parties on this issue. If a party's position is not mentioned in the provided information, clearly state that.";
                }
                // Get response from LLM
                const result = yield this.chat.sendMessage([{ text: prompt }]);
                const response = result.response.text();
                return response;
            }
            catch (error) {
                console.error('Error asking question:', error);
                return `Error: ${error.message || 'Something went wrong'}`;
            }
        });
    }
}
// Interactive CLI for chat
function startPolicyChat() {
    return __awaiter(this, void 0, void 0, function* () {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const chatbot = new PolicyChatbot();
        console.log('\n🇨🇦 Liberal vs Conservative Policy Analyzer 🇨🇦');
        console.log('Ask questions about Liberal and Conservative party policies (type "exit" to quit, "compare" to compare parties)\n');
        const askQuestion = () => {
            rl.question('\nYour question: ', (question) => __awaiter(this, void 0, void 0, function* () {
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
                const answer = yield chatbot.ask(question, {
                    compareParties,
                    specificParties: specificParties.length > 0 ? specificParties : undefined
                });
                console.log('\n' + answer);
                askQuestion();
            }));
        };
        askQuestion();
    });
}
// If this file is run directly
if (require.main === module) {
    startPolicyChat().catch(error => {
        console.error('Error starting policy chat:', error);
        process.exit(1);
    });
}
