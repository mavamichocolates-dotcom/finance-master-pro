
import { GoogleGenAI, Type } from "@google/genai";

export type AiProvider = 'gemini' | 'openai';

interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

class AIService {
  private getConfig(): AiConfig {
    const saved = localStorage.getItem('fm_ai_config');
    if (saved) return JSON.parse(saved);
    
    return {
      provider: 'gemini',
      apiKey: process.env.API_KEY || '',
      model: 'gemini-3-flash-preview'
    };
  }

  private getGeminiClient(apiKey: string) {
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Regras fixas de negócio que precedem a IA
   */
  private applyLocalRules(description: string): string | null {
    const desc = description.toLowerCase();
    if (desc.includes('uber') || desc.includes('lalamove')) {
      return 'Frete';
    }
    return null;
  }

  private async callOpenAI(prompt: string, model: string, apiKey: string, isJson: boolean = false) {
    if (!apiKey) throw new Error("API_KEY_MISSING");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: isJson ? { type: "json_object" } : undefined,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Erro na API da OpenAI");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<string> {
    // 1. Verificar Regras Locais primeiro
    const localMatch = this.applyLocalRules(description);
    if (localMatch && categories.includes(localMatch)) return localMatch;

    const config = this.getConfig();
    const prompt = `
      Você é um assistente financeiro para a Mirella Doces.
      Descrição: "${description}"
      Tipo: ${type === 'INCOME' ? 'Entrada' : 'Saída'}
      Categorias Permitidas: ${JSON.stringify(categories)}
      Responda APENAS com o nome da categoria exata da lista. Se não souber ou for ambíguo, responda "Outros".
    `;

    try {
      let result = "";
      if (config.provider === 'openai') {
        result = await this.callOpenAI(prompt, config.model, config.apiKey);
      } else {
        const ai = this.getGeminiClient(config.apiKey);
        const response = await ai.models.generateContent({
          model: config.model || 'gemini-3-flash-preview',
          contents: prompt,
        });
        result = response.text || "Outros";
      }

      const suggested = result.trim();
      return categories.find(c => c.toLowerCase() === suggested.toLowerCase()) || "Outros";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Outros";
    }
  }

  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    // Aplicar regras locais antes de enviar para a IA
    const processedItems = items.map(item => {
      const ruleMatch = this.applyLocalRules(item.description);
      return { ...item, localMatch: ruleMatch };
    });

    const itemsForAi = processedItems.filter(i => !i.localMatch);
    const results = processedItems.filter(i => i.localMatch).map(i => ({
      description: i.description,
      category: i.localMatch
    }));

    if (itemsForAi.length === 0) return results;

    const config = this.getConfig();
    const prompt = `
      Classifique as transações para uma doceria.
      Categorias: ${JSON.stringify(allCategories)}
      Transações: ${JSON.stringify(itemsForAi)}
      Retorne um JSON: [{"description": "...", "category": "..."}]. 
      Use APENAS categorias da lista fornecida. Se não tiver certeza, use "Outros".
    `;

    try {
      let jsonStr = "";
      if (config.provider === 'openai') {
        jsonStr = await this.callOpenAI(prompt, config.model, config.apiKey, true);
      } else {
        const ai = this.getGeminiClient(config.apiKey);
        const response = await ai.models.generateContent({
          model: config.model || 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
                required: ["description", "category"]
              }
            }
          }
        });
        jsonStr = response.text || "[]";
      }
      
      const aiResults = JSON.parse(jsonStr);
      return [...results, ...aiResults];
    } catch (error) {
      console.error("Erro na classificação em massa:", error);
      return results; // Retorna pelo menos o que as regras locais pegaram
    }
  }
}

export const aiService = new AIService();
