export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  storeOwnerId?: number; // optional: scope queries to a specific store
}

export interface Insight {
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  description: string;
  priority: number; // 1 = highest
}

export interface InsightsResponse {
  insights: Insight[];
  generatedAt: string;
}
