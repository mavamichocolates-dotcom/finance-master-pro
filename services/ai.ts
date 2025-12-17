
import { GoogleGenAI, Type } from "@google/genai";

export type AiProvider = 'gemini' | 'openai';

interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

class AIService {
  private HISTORY_KEY = 'fm_category_history';

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
   * Normaliza a descrição para ignorar números, datas e códigos variáveis.
   * Ex: "Uber *1234 15/10" vira "uber"
   */
  private normalizeDescription(desc: string): string {
    return desc
      .toLowerCase()
      .replace(/[0-9]/g, '') // Remove números
      .replace(/[^\w\s]/gi, '') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Remove espaços duplos
      .trim();
  }

  /**
   * Salva uma correção manual como "Verdade Absoluta"
   */
  public learn(description: string, category: string) {
    if (!description || !category || category === 'Outros') return;
    
    const history = this.getHistory();
    const normalized = this.normalizeDescription(description);
    
    history[normalized] = category;
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    console.log(`[IA] Aprendido: "${normalized}" -> ${category}`);
  }

  private getHistory(): Record<string, string> {
    const saved = localStorage.getItem(this.HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  private getLearnedCategory(description: string): string | null {
    const history = this.getHistory();
    const normalized = this.normalizeDescription(description);
    return history[normalized] || null;
  }

  private getGeminiClient(apiKey: string) {
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return new GoogleGenAI({ apiKey });
  }

  private async callOpenAI(prompt: string, model: string, apiKey: string) {
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
        temperature: 0
      })
    });

    if (!response.ok) return "Outros";
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<string> {
    // 1. PRIORIDADE MÁXIMA: Histórico Aprendido (Verdade Absoluta)
    const learned = this.getLearnedCategory(description);
    if (learned && categories.includes(learned)) return learned;

    // 2. IA como fallback se não houver padrão conhecido
    const config = this.getConfig();
    const prompt = `
      SISTEMA DE CATEGORIZAÇÃO FINANCEIRA.
      Categorias Permitidas: ${JSON.stringify(categories)}
      Regra: Responda APENAS o nome da categoria. Sem explicações.
      Descrição: "${description}"
      Tipo: ${type === 'INCOME' ? 'Receita' : 'Saída'}
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
          config: { temperature: 0 }
        });
        result = response.text || "Outros";
      }

      const suggested = result.trim();
      return categories.find(c => c.toLowerCase() === suggested.toLowerCase()) || "Outros";
    } catch (error) {
      return "Outros";
    }
  }

  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    const history = this.getHistory();
    
    // Processa o que já é conhecido localmente primeiro
    const results = items.map(item => {
      const normalized = this.normalizeDescription(item.description);
      const learned = history[normalized];
      return {
        description: item.description,
        category: (learned && allCategories.includes(learned)) ? learned : null
      };
    });

    const pending = results.filter(r => !r.category);
    if (pending.length === 0) return results;

    const config = this.getConfig();
    const prompt = `
      Classifique as transações.
      Categorias Permitidas: ${JSON.stringify(allCategories)}
      Transações: ${JSON.stringify(pending.map(p => p.description))}
      Retorne APENAS um JSON: [{"description": "...", "category": "..."}]
    `;

    try {
      let jsonStr = "";
      if (config.provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0
          })
        });
        const data = await res.json();
        jsonStr = data.choices[0].message.content;
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
