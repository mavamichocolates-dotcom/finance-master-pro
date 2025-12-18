
import { GoogleGenAI, Type } from "@google/genai";

export interface SuggestionResult {
  category: string;
  confidence: number;
  alternatives: string[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface RouteAnalysisResponse {
  text: string;
  sources: GroundingSource[];
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

  async optimizeDeliveryRoutes(orders: any[], userLocation?: { lat: number, lng: number }): Promise<RouteAnalysisResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const ordersList = orders.map(o => {
      const addr = o.pdvData.deliveryAddress || o.pdvData.region;
      return `- Pedido: ${o.pdvData.productName}, Cliente: ${o.pdvData.contact || 'S/N'}, Endereço: ${addr}`;
    }).join('\n');
    
    const prompt = `
      Sou uma doceria (Mirella Doces). Tenho os seguintes pedidos para entrega hoje:
      ${ordersList}

      Por favor, analise esses endereços usando o Google Maps:
      1. Identifique quais pedidos estão próximos entre si.
      2. Crie "grupos de entrega" (rotas) otimizadas.
      3. Sugira uma ordem de paradas.
      4. Mencione os bairros principais identificados.

      Importante: Forneça links do Google Maps que agrupem esses endereços se possível.
      Responda em Português do Brasil com tom profissional.
    `;

    const response = await ai.models.generateContent({
      model: this.MODEL_MAPS,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }] as any,
        toolConfig: {
          retrievalConfig: {
            latLng: userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined
          }
        } as any
      }
    });

    // Extrair fontes de grounding obrigatórias
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          sources.push({
            title: chunk.maps.title || "Localização no Maps",
            uri: chunk.maps.uri
          });
        }
      });
    }

    return {
      text: response.text || "Análise concluída.",
      sources: sources
    };
  }
}

export const aiService = new AIService();
