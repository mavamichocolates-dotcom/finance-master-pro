import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in-up">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl relative">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          type="button"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-red-900/30 p-3 rounded-full mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-gray-300">{message}</p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform hover:scale-105 font-bold"
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;