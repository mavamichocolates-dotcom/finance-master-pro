
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Key, Zap, Info, ShieldCheck, ExternalLink, Cpu, CheckCircle2 } from 'lucide-react';
import { AiProvider } from '../services/ai';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const AiConfigModal: React.FC<AiConfigModalProps> = ({ isOpen, onClose, onSave }) => {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('fm_ai_config');
    if (saved) {
      const config = JSON.parse(saved);
      setProvider(config.provider);
      setApiKey(config.apiKey);
      setModel(config.model);
    } else {
      setProvider('gemini');
      setModel('gemini-3-flash-preview');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const config = { provider, apiKey, model };
    localStorage.setItem('fm_ai_config', JSON.stringify(config));
    onSave();
    onClose();
  };

  const tryNativeSelector = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        // A chave é injetada em process.env.API_KEY pelo sistema, mas aqui podemos tentar capturar 
        // ou avisar o usuário que agora ele pode deixar o campo em branco se preferir.
        alert("Chave selecionada via sistema! Você já pode fechar este modal ou salvar.");
      } catch (e) {
        alert("Erro ao abrir seletor nativo.");
      }
    } else {
      alert("Seletor nativo não suportado. Por favor, insira a chave manualmente abaixo.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-fade-in-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600/20 p-2 rounded-lg">
              <Sparkles className="text-purple-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurar Inteligência Artificial</h2>
              <p className="text-xs text-gray-400">Escolha seu cérebro digital</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* PROVIDER SELECTOR */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => { setProvider('gemini'); setModel('gemini-3-flash-preview'); }}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${provider === 'gemini' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'}`}
            >
              <Cpu size={32} className={provider === 'gemini' ? 'text-blue-400' : 'text-gray-500'} />
              <span className={`font-bold ${provider === 'gemini' ? 'text-white' : 'text-gray-400'}`}>Google Gemini</span>
              <span className="text-[10px] text-gray-500">Rápido e Gratuito*</span>
            </button>
            <button 
              onClick={() => { setProvider('openai'); setModel('gpt-4o-mini'); }}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${provider === 'openai' ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'}`}
            >
              <Zap size={32} className={provider === 'openai' ? 'text-green-400' : 'text-gray-500'} />
              <span className={`font-bold ${provider === 'openai' ? 'text-white' : 'text-gray-400'}`}>OpenAI ChatGPT</span>
              <span className="text-[10px] text-gray-500">Padrão da Indústria</span>
            </button>
          </div>

          <div className="space-y-4 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                Chave API (API Key)
                {provider === 'gemini' && (
                   <button onClick={tryNativeSelector} className="text-blue-400 hover:underline flex items-center gap-1">
                      Usar Seletor do Sistema <ExternalLink size={10} />
                   </button>
                )}
              </label>
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? "Cole sua chave do Google AI Studio..." : "sk-..."}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:border-purple-500 outline-none pr-12 text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-white"
                >
                  <Key size={18} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Modelo</label>
              <select 
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:border-purple-500 outline-none text-sm"
              >
                {provider === 'gemini' ? (
                  <>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Recomendado)</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (Melhor Raciocínio)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </>
                ) : (
                  <>
                    <option value="gpt-4o-mini">GPT-4o Mini (Econômico)</option>
                    <option value="gpt-4o">GPT-4o (Poderoso)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-blue-900/10 p-3 rounded-lg border border-blue-900/20">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-300 leading-relaxed">
              Sua chave é armazenada de forma segura no <strong>armazenamento local do seu navegador</strong>. 
              Ela nunca é enviada para nossos servidores, apenas diretamente para a {provider === 'gemini' ? 'Google' : 'OpenAI'}.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-900/30">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button 
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
          >
            <CheckCircle2 size={18} /> Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiConfigModal;
