
import { GoogleGenAI, Type } from "@google/genai";

class AIService {
  private getClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("ERRO CRÍTICO: Chave de API (process.env.API_KEY) não encontrada. Verifique as configurações de ambiente.");
      throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Sugere uma categoria baseada na descrição e tipo de transação.
   */
  async suggestCategory(description: string, type: 'INCOME' | 'EXPENSE', categories: string[]): Promise<string> {
    try {
      const ai = this.getClient();
      const prompt = `
        Você é um assistente financeiro especializado para a Mirella Doces.
        Dado a descrição de uma transação e uma lista de categorias, escolha a categoria que melhor se encaixa.
        
        Descrição: "${description}"
        Tipo: ${type === 'INCOME' ? 'Entrada (Receita)' : 'Saída (Despesa)'}
        Categorias Permitidas: ${JSON.stringify(categories)}
        
        Regras:
        1. Responda APENAS com o nome da categoria, exatamente como escrita na lista.
        2. Se não tiver certeza absoluta, responda "Outros".
        3. Não adicione pontuação ou explicações.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const suggested = response.text?.trim() || "Outros";
      
      // Valida se a resposta está na lista original
      const match = categories.find(c => c.toLowerCase() === suggested.toLowerCase());
      return match || "Outros";
    } catch (error: any) {
      console.error("Erro detalhado na sugestão de IA:", error);
      if (error.message === "API_KEY_MISSING") throw error;
      return "Outros";
    }
  }

  /**
   * Classifica múltiplos itens de uma vez.
   */
  async classifyBulk(items: { description: string, type: string }[], allCategories: string[]) {
    try {
      const ai = this.getClient();
      
      // Limpeza básica para evitar quebra de JSON no prompt
      const cleanItems = items.map(i => ({
        description: i.description.substring(0, 100).replace(/["']/g, ""),
        type: i.type
      }));

      const prompt = `
        Classifique as seguintes transações bancárias nas categorias apropriadas para uma doceria/confeitaria.
        Categorias válidas: ${JSON.stringify(allCategories)}
        
        Transações:
        ${JSON.stringify(cleanItems)}
        
        Retorne um JSON contendo um array de objetos com 'description' e 'category'.
        Use EXATAMENTE os nomes das categorias fornecidas.
      `;

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

      const results = JSON.parse(response.text || "[]");
      console.log("IA classificou com sucesso:", results);
      return results;
    } catch (error: any) {
      console.error("Erro detalhado na classificação em massa:", error);
      throw error;
    }
  }
}

export const aiService = new AIService();
