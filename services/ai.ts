
import { GoogleGenAI, Type } from "@google/genai";

export interface SuggestionResult {
  category: string;
  confidence: number;
  alternatives: string[];
}

export interface RouteOptimization {
  summary: string;
  groups: {
    label: string;
    orders: string[];
    mapLink: string;
  }[];
}

class AIService {
  private HISTORY_KEY = 'fm_learned_patterns';
  private MODEL_TEXT = 'gemini-3-flash-preview';
  private MODEL_MAPS = 'gemini-2.5-flash';

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

  // Fix: Added classifyBulk method to AIService to handle batch categorization requests from BankImportModal.tsx
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

  async optimizeDeliveryRoutes(orders: any[], userLocation?: { lat: number, lng: number }): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const ordersList = orders.map(o => `- Pedido: ${o.pdvData.productName}, Endereço: ${o.pdvData.deliveryAddress || o.pdvData.region}`).join('\n');
    
    const prompt = `
      Sou uma doceria (Mirella Doces). Tenho os seguintes pedidos para entrega hoje:
      ${ordersList}

      Por favor, analise esses endereços usando o Google Maps. 
      1. Agrupe os pedidos que estão próximos ou na mesma rota.
      2. Sugira uma ordem lógica de entrega para cada grupo.
      3. Forneça links do Google Maps (Google Maps URLs) para cada rota sugerida.
      
      Seja conciso e use Markdown para formatar a resposta.
    `;

    const response = await ai.models.generateContent({
      model: this.MODEL_MAPS,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined
          }
        }
      }
    });

    return response.text || "Não foi possível gerar as rotas no momento.";
  }
}

export const aiService = new AIService();
