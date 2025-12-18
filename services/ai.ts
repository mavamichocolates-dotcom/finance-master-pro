
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
    
    // Preparar lista de pedidos para o prompt
    const ordersList = orders.map(o => {
      const addr = o.pdvData.deliveryAddress || o.pdvData.region;
      return `- Pedido #${o.id.substring(0,4)}: ${o.pdvData.productName}, Para: ${o.pdvData.contact || 'Cliente'}, Local: ${addr}`;
    }).join('\n');
    
    const prompt = `
      Você é um especialista em logística. Preciso otimizar as entregas de hoje para a Mirella Doces.
      Pedidos agendados:
      ${ordersList}

      Tarefas:
      1. Identifique as coordenadas e regiões de cada endereço usando o Google Maps.
      2. Agrupe pedidos que estão na mesma direção ou bairro.
      3. Sugira uma ordem de entrega (rota) eficiente para economizar tempo.
      4. Justifique brevemente por que essa ordem é a melhor.

      Importante: Forneça a análise em Português e, se possível, gere links consolidados do Google Maps.
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

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          sources.push({
            title: chunk.maps.title || "Abrir no Google Maps",
            uri: chunk.maps.uri
          });
        }
      });
    }

    return {
      text: response.text || "Não foi possível gerar a análise logística no momento.",
      sources: sources
    };
  }
}

export const aiService = new AIService();
