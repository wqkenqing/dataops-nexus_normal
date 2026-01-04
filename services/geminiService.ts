import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize Gemini Client safely
// The API key is assumed to be available in process.env.API_KEY
// We wrap this in a safe check to prevent the entire app from crashing if the key is missing locally.
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error("Error initializing GoogleGenAI client:", error);
  }
}

const MODEL_NAME = 'gemini-2.5-flash';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}

export const getGeminiResponse = async (
  prompt: string,
  contextData: string,
  chatHistory: ChatMessage[]
): Promise<string> => {
  if (!ai) {
    return "⚠️ Configuration Error: API Key is missing.\n\nPlease ensure `process.env.API_KEY` is set in your environment variables to enable Ops Copilot.";
  }

  try {
    const historyForModel = chatHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

    // Construct a system instruction that includes the current context of the dashboard
    const systemInstruction = `
      You are an expert Data Operations Engineer Assistant (Ops Copilot).
      You help manage Big Data components like Elasticsearch, Kafka, and ClickHouse.
      
      CURRENT DASHBOARD CONTEXT:
      ${contextData}

      Rules:
      1. Use the context above to answer specific questions about the clusters.
      2. If status is RED or DEGRADED, suggest potential troubleshooting steps.
      3. Be concise, technical, and professional.
      4. If the user asks for commands, provide relevant CLI commands (e.g., kafka-topics.sh, clickhouse-client).
    `;

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Low temperature for more factual technical responses
      },
      history: historyForModel
    });

    const result: GenerateContentResponse = await chat.sendMessage({
      message: prompt
    });

    return result.text || "I couldn't generate a response at this time.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to Ops Copilot. Please check your API key or network connection.";
  }
};