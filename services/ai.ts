
import { GoogleGenAI, Type } from "@google/genai";

export interface SuggestionResult {
  category: string;
  confidence: number;
  alternatives: string[];
}

class AIService {
  private HISTORY_KEY = 'fm_learned_patterns';
  private MODEL_TEXT = 'gemini-3-flash-preview';

  private normalizeDescription(desc: string): string {
    return desc.toLowerCase().replace(/[0-9]/g, '').replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
  }

  public learn(description: string, category: string) {
    if (!description || !category || category === 'Outros') return;
    const history = this.getHistory();
    const pattern = this.normalizeDescription(description);
    if (pattern.length > 2) {
      history[pattern] = category;
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    }
  }

  private getHistory(): Record<string, string> {
    const saved = localStorage.getItem(this.HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<SuggestionResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: this.MODEL_TEXT,
      contents: `Classifique: "${description}" (${type}). Categorias: ${JSON.stringify(categories)}`,
      config: { 
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["category", "confidence", "alternatives"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }

  async classifyBulk(items: { description: string }[], categories: string[]): Promise<{ description: string, category: string }[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const descriptions = items.map(i => i.description);
    const prompt = `Classifique as seguintes descrições de transações bancárias nas categorias fornecidas. 
Categorias permitidas: ${JSON.stringify(categories)}
Descrições para classificar: ${JSON.stringify(descriptions)}`;

    const response = await ai.models.generateContent({
      model: this.MODEL_TEXT,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["description", "category"]
          }
        }
      }
    });

    try {
      const text = response.text || "[]";
      return JSON.parse(text);
    } catch (e) {
      console.error("Erro ao processar resposta em lote da IA:", e);
      return [];
    }
  }
}

export const aiService = new AIService();
