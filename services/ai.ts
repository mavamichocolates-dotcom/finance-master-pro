
import { GoogleGenAI, Type } from "@google/genai";

class AIService {
  private getClient() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY do Gemini não configurada.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Sugere uma categoria baseada na descrição e tipo de transação.
   */
  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<string> {
    const ai = this.getClient();
    const prompt = `
      Você é um assistente financeiro especializado.
      Dado a descrição de uma transação e uma lista de categorias permitidas, escolha a categoria que melhor se encaixa.
      
      Descrição: "${description}"
      Tipo: ${type === 'INCOME' ? 'Entrada (Receita)' : 'Saída (Despesa)'}
      Categorias Permitidas: ${JSON.stringify(categories)}
      
      Regras:
      1. Responda APENAS com o nome da categoria, exatamente como escrita na lista.
      2. Se não tiver certeza absoluta, responda "Outros".
      3. Não adicione pontuação ou explicações.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const suggested = response.text?.trim() || "Outros";
      return categories.includes(suggested) ? suggested : "Outros";
    } catch (error) {
      console.error("Erro na sugestão de IA:", error);
      return "Outros";
    }
  }

  /**
   * Classifica múltiplos itens de uma vez (ideal para importação).
   */
  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    const ai = this.getClient();
    const prompt = `
      Classifique as seguintes transações bancárias nas categorias apropriadas.
      Categorias válidas: ${JSON.stringify(allCategories)}
      
      Transações:
      ${JSON.stringify(items)}
      
      Retorne um JSON contendo um array de objetos com 'description' e 'category'.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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

      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Erro na classificação em massa:", error);
      return [];
    }
  }
}

export const aiService = new AIService();
