
// Fix: Strictly follow @google/genai guidelines for API key and model usage
import { GoogleGenAI, Type } from "@google/genai";

export interface SuggestionResult {
  category: string;
  confidence: number;
  alternatives: string[];
}

class AIService {
  private HISTORY_KEY = 'fm_learned_patterns';
  private MODEL_NAME = 'gemini-3-flash-preview';

  private normalizeDescription(desc: string): string {
    return desc
      .toLowerCase()
      .replace(/[0-9]/g, '')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
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

  private getLearnedCategory(description: string): string | null {
    const history = this.getHistory();
    const pattern = this.normalizeDescription(description);
    return history[pattern] || null;
  }

  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<SuggestionResult> {
    // 1. Verificação de aprendizado local (Confiança 100%)
    const learned = this.getLearnedCategory(description);
    if (learned && categories.includes(learned)) {
      return {
        category: learned,
        confidence: 1.0,
        alternatives: []
      };
    }

    // 2. IA para novos padrões
    const prompt = `
      Classifique o lançamento financeiro abaixo.
      Descrição: "${description}"
      Tipo: ${type === 'INCOME' ? 'Receita/Venda' : 'Despesa/Custo'}
      Categorias Disponíveis: ${JSON.stringify(categories)}

      Instruções:
      - Escolha a categoria mais provável.
      - Defina um nível de confiança de 0.0 a 1.0.
      - Liste até 2 alternativas caso haja ambiguidade.
    `;

    try {
      // Fix: Use process.env.API_KEY directly as required by guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { 
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              alternatives: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["category", "confidence", "alternatives"]
          }
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      
      // Validação básica para garantir que a categoria existe na lista do usuário
      const validCategory = categories.find(c => c.toLowerCase() === result.category?.toLowerCase()) || "Outros";
      const validAlternatives = (result.alternatives || [])
        .map((alt: string) => categories.find(c => c.toLowerCase() === alt.toLowerCase()))
        .filter((alt: string | undefined): alt is string => !!alt && alt !== validCategory);

      return {
        category: validCategory,
        confidence: result.confidence || 0.5,
        alternatives: validAlternatives
      };
    } catch (error) {
      console.error("[IA Error]", error);
      return { category: "Outros", confidence: 0, alternatives: [] };
    }
  }

  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    const history = this.getHistory();
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

    const prompt = `
      Classifique os lançamentos abaixo.
      Categorias Permitidas: ${JSON.stringify(allCategories)}
      Lançamentos: ${JSON.stringify(pending.map(p => p.description))}
    `;

    try {
      // Fix: Use process.env.API_KEY directly as required by guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
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
      console.error("[IA Bulk Error]", error);
      return results.map(r => ({ ...r, category: r.category || "Outros" }));
    }
  }
}

export const aiService = new AIService();
