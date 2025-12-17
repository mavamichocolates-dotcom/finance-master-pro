
import { GoogleGenAI, Type } from "@google/genai";

export type AiProvider = 'gemini' | 'openai';

interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

class AIService {
  private HISTORY_KEY = 'fm_learned_patterns';

  private getConfig(): AiConfig {
    const saved = localStorage.getItem('fm_ai_config');
    if (saved) return JSON.parse(saved);
    
    return {
      provider: 'gemini',
      apiKey: process.env.API_KEY || '',
      model: 'gemini-3-flash-preview'
    };
  }

  /**
   * Remove números, datas, códigos e caracteres especiais para identificar o padrão puro.
   */
  private normalizeDescription(desc: string): string {
    return desc
      .toLowerCase()
      .replace(/[0-9]/g, '') // Remove todos os números
      .replace(/[^\w\s]/gi, '') // Remove caracteres especiais/pontuação
      .replace(/\s+/g, ' ') // Remove espaços múltiplos
      .trim();
  }

  /**
   * Registra uma escolha do usuário como Verdade Absoluta.
   */
  public learn(description: string, category: string) {
    if (!description || !category || category === 'Outros') return;
    
    const history = this.getHistory();
    const pattern = this.normalizeDescription(description);
    
    // Só salva se o padrão for relevante (mais de 2 letras)
    if (pattern.length > 2) {
      history[pattern] = category;
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
      console.log(`[IA Aprendizado] Padrão memorizado: "${pattern}" -> ${category}`);
    }
  }

  private getHistory(): Record<string, string> {
    const saved = localStorage.getItem(this.HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  private getLearnedCategory(description: string): string | null {
    const history = this.getHistory();
    const pattern = this.normalizeDescription(description);
    return history[pattern] || null;
  }

  private getGeminiClient(apiKey: string) {
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return new GoogleGenAI({ apiKey });
  }

  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<string> {
    // 1. PRIORIDADE MÁXIMA: Verificar se já aprendi esse padrão antes
    const learned = this.getLearnedCategory(description);
    if (learned && categories.includes(learned)) {
      return learned;
    }

    // 2. IA como fallback para novos lançamentos
    const config = this.getConfig();
    const prompt = `
      Você é um sistema de categorização financeira determinístico.
      Regras:
      1. Responda APENAS o nome da categoria da lista.
      2. Descrição: "${description}"
      3. Categorias Permitidas: ${JSON.stringify(categories)}
      Resposta:
    `;

    try {
      const ai = this.getGeminiClient(config.apiKey);
      const response = await ai.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.1 } // Mais determinístico
      });
      
      const suggested = (response.text || "Outros").trim();
      return categories.find(c => c.toLowerCase() === suggested.toLowerCase()) || "Outros";
    } catch (error) {
      return "Outros";
    }
  }

  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    const history = this.getHistory();
    
    // Processa o que já é conhecido localmente (Verdade Absoluta)
    const results = items.map(item => {
      const pattern = this.normalizeDescription(item.description);
      const learned = history[pattern];
      return {
        description: item.description,
        category: (learned && allCategories.includes(learned)) ? learned : null
      };
    });

    const pending = results.filter(r => !r.category);
    if (pending.length === 0) return results;

    // IA para o que sobrou
    const config = this.getConfig();
    const prompt = `
      Classifique os lançamentos abaixo seguindo os padrões de uma doceria.
      Categorias Permitidas: ${JSON.stringify(allCategories)}
      Lançamentos: ${JSON.stringify(pending.map(p => p.description))}
      Retorne um JSON: [{"description": "...", "category": "..."}]
    `;

    try {
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
      
      const aiResults = JSON.parse(response.text || "[]");
      return results.map(r => {
        if (r.category) return r;
        const aiMatch = aiResults.find((ar: any) => ar.description === r.description);
        return { ...r, category: aiMatch?.category || "Outros" };
      });
    } catch (error) {
      return results.map(r => ({ ...r, category: r.category || "Outros" }));
    }
  }
}

export const aiService = new AIService();
