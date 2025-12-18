
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Trash2, Edit2, UserPlus, Shield, Store, Save, X, Loader2, AlertCircle, Skull, Network, CheckCircle2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface UserManagementProps {
  availableUnits: string[];
}

const UserManagement: React.FC<UserManagementProps> = ({ availableUnits }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  
  // Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, action: () => void}>({
    isOpen: false, action: () => {}
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await db.getUsers();
      
      // Adiciona o usuário atual à lista se ele for o master-override (para feedback visual)
      const currentUser = auth.getCurrentUser();
      if (currentUser && currentUser.id === 'master-override' && !data.find(u => u.id === 'master-override')) {
        setUsers([currentUser, ...data]);
      } else {
        setUsers(data);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user?: User) => {
    if (user) {
      if (user.id === 'master-override') {
        alert('O usuário Master Admin é fixo do sistema e não pode ser editado aqui.');
        return;
      }
      setEditingUser({ ...user, passwordHash: '' }); 
    } else {
      setEditingUser({
        name: '',
        email: '',
        role: 'COLLABORATOR',
        allowedUnits: [],
        active: true,
        passwordHash: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (id === 'master-override') {
      alert('Não é possível excluir o usuário mestre do sistema.');
      return;
    }

    const user = users.find(u => u.id === id);
    if (user && user.role === 'ADMIN' && users.filter(u => u.role === 'ADMIN').length <= 1) {
      alert('Não é possível excluir o único administrador.');
      return;
    }
    
    setConfirmConfig({
      isOpen: true,
      action: async () => {
        setLoading(true);
        try {
          await db.deleteUser(id);
          await loadUsers();
        } catch (error: any) {
          alert(`Erro ao excluir: ${error.message || 'Erro desconhecido'}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.name || !editingUser.email) return;

    if (!editingUser.id && !editingUser.passwordHash) {
      alert('Senha é obrigatória para novos usuários.');
      return;
    }

    setLoading(true);
    try {
      const userData: User = {
        id: editingUser.id || '', 
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role as UserRole || 'COLLABORATOR',
        allowedUnits: editingUser.allowedUnits || [],
        active: editingUser.active ?? true,
        createdAt: editingUser.createdAt || new Date().toISOString(),
        passwordHash: editingUser.passwordHash || ''
      } as User;

      await db.saveUser(userData);
      setIsModalOpen(false);
      await loadUsers();
    } catch (error: any) {
      console.error("Erro ao salvar usuário:", error);
      alert(`Erro: ${error.message || 'Falha ao salvar usuário'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnitPermission = (unit: string) => {
    const current = editingUser.allowedUnits || [];
    if (current.includes(unit)) {
      setEditingUser({ ...editingUser, allowedUnits: current.filter(u => u !== unit) });
    } else {
      setEditingUser({ ...editingUser, allowedUnits: [...current, unit] });
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      await db.getUnits(); 
      alert(`✅ SUCESSO! Conexão estável com o Banco de Dados Local/Nuvem.`);
    } catch (e: any) {
      alert(`❌ ERRO DE CONEXÃO: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = () => {
    const confirmation = window.prompt('ATENÇÃO: ISSO APAGARÁ TODOS OS DADOS (USUÁRIOS, TRANSAÇÕES, LOJAS).\n\nPara confirmar, digite "DELETAR TUDO" abaixo:');
    
    if (confirmation === "DELETAR TUDO") {
      setLoading(true);
      db.clearAllData()
        .then(() => {
          alert('Sistema resetado com sucesso! A página será recarregada.');
          window.location.reload();
        })
        .catch((err) => {
          alert('Erro ao resetar: ' + err.message);
        })
        .finally(() => setLoading(false));
    }
  };

  if (loading && !isModalOpen && users.length === 0) {
    return <div className="p-8 text-center text-gray-500 flex justify-center items-center h-64"><Loader2 className="animate-spin inline mr-2"/> Carregando usuários...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="flex justify-between items-center bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-500" />
            Gestão de Usuários
          </h2>
          <p className="text-gray-400 text-sm">Controle de acesso e permissões por loja</p>
        </div>
        <button
          onClick={() => handleEdit()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg transition-transform hover:scale-105"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-blue-500/50 transition-colors shadow-lg flex flex-col justify-between group relative overflow-hidden">
            {user.id === 'master-override' && (
              <div className="absolute top-0 right-0 bg-yellow-600/20 text-yellow-500 text-[8px] font-black px-2 py-0.5 uppercase tracking-tighter border-l border-b border-yellow-600/30 rounded-bl">
                Usuário Mestre
              </div>
            )}
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-inner ${
                    user.role === 'ADMIN' ? 'bg-blue-900/50 text-blue-400' : 
                    user.role === 'MANAGER' ? 'bg-purple-900/50 text-purple-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold group-hover:text-blue-400 transition-colors truncate">{user.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border whitespace-nowrap ml-2 ${
                  user.role === 'ADMIN' ? 'bg-blue-900/20 text-blue-400 border-blue-900' :
                  user.role === 'MANAGER' ? 'bg-purple-900/20 text-purple-400 border-purple-900' :
                  'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {user.role}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1">
                    <Store size={12} /> Acesso às Lojas
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {user.role === 'ADMIN' ? (
                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50 flex items-center gap-1">
                        <Shield size={10} /> Acesso Total
                      </span>
                    ) : user.allowedUnits.length > 0 ? (
                      user.allowedUnits.map(u => (
                        <span key={u} className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">{u}</span>
                      ))
                    ) : (
                      <span className="text-xs text-red-400 italic flex items-center gap-1">
                        <AlertCircle size={10} /> Nenhuma loja vinculada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700 opacity-60 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleEdit(user)}
                disabled={user.id === 'master-override'}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-20"
                title="Editar"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(user.id)}
                disabled={user.id === 'master-override'}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-20"
                title="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SYSTEM TOOLS AREA */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-blue-900/30 rounded-lg bg-blue-900/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-900/30 p-2 rounded text-blue-400">
              <Network size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-400">Diagnóstico de Sistema</h3>
              <p className="text-xs text-blue-300/70">Verifique a comunicação com o banco de dados.</p>
            </div>
          </div>
          <button 
            onClick={handleTestConnection}
            className="w-full bg-blue-800/50 hover:bg-blue-700/50 text-blue-200 border border-blue-700/50 px-4 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle2 size={16} />
            Testar Conectividade
          </button>
        </div>

        <div className="border border-red-900/30 rounded-lg bg-red-900/10 p-6">
          <div className="flex items-center gap-3 mb-4">
             <div className="bg-red-900/30 p-2 rounded text-red-500">
               <Skull size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-red-400">Zona de Perigo</h3>
               <p className="text-xs text-red-300/70">Ações irreversíveis que afetam todo o banco de dados.</p>
             </div>
          </div>
          
          <button 
            onClick={handleResetSystem}
            className="w-full bg-red-900/50 hover:bg-red-800/50 text-red-200 border border-red-800/50 px-4 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={16} />
            LIMPAR TODO O SISTEMA
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        >
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-xl shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {editingUser.id ? <Edit2 size={20} className="text-blue-500" /> : <UserPlus size={20} className="text-blue-500" />}
                {editingUser.id ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome de Login</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name || ''}
                    onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="Ex: Pedro"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">E-mail</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email || ''}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="pedro@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Senha</label>
                  <input
                    type="password"
                    placeholder={editingUser.id ? "Manter senha atual" : "Crie uma senha"}
                    value={editingUser.passwordHash || ''}
                    onChange={e => setEditingUser({...editingUser, passwordHash: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nível de Acesso</label>
                  <select
                    value={editingUser.role || 'COLLABORATOR'}
                    onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="COLLABORATOR">Vendedor (Acesso PDV)</option>
                    <option value="MANAGER">Gestor (Acesso Lançamentos)</option>
                    <option value="ADMIN">Administrador (Acesso Total)</option>
                  </select>
                </div>
              </div>

              {editingUser.role !== 'ADMIN' && (
                <div className="bg-gray-950 p-4 rounded-lg border border-gray-700">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Unidades Permitidas</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {availableUnits.map(unit => (
                      <label key={unit} className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.allowedUnits?.includes(unit)}
                          onChange={() => toggleUnitPermission(unit)}
                          className="w-4 h-4 rounded bg-gray-900 border-gray-700"
                        />
                        {unit}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-bold uppercase text-xs">Cancelar</button>
                <button type="submit" className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs rounded-xl shadow-lg">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title="Remover Acesso"
        message="Deseja realmente excluir este usuário? Esta ação não pode ser desfeita."
        onConfirm={() => {
          confirmConfig.action();
          setConfirmConfig({isOpen: false, action: () => {}});
        }}
        onCancel={() => setConfirmConfig({isOpen: false, action: () => {}})}
      />
    </div>
  );
};

export default UserManagement;
