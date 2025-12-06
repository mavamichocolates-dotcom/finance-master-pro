import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/db';
import { Trash2, Edit2, UserPlus, Shield, Store, Save, X, Loader2 } from 'lucide-react';
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
    const data = await db.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleEdit = (user?: User) => {
    if (user) {
      setEditingUser({ ...user, passwordHash: '' }); // Don't show hash
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
    const user = users.find(u => u.id === id);
    if (user && user.role === 'ADMIN' && users.filter(u => u.role === 'ADMIN').length <= 1) {
      alert('Não é possível excluir o único administrador.');
      return;
    }
    
    setConfirmConfig({
      isOpen: true,
      action: async () => {
        setLoading(true);
        await db.deleteUser(id);
        await loadUsers();
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
        id: editingUser.id || '', // Se for vazio, o DB/Supabase gera
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
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar usuário. Verifique se o email já existe ou se as permissões (RLS) estão configuradas no Supabase.');
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

  if (loading && !isModalOpen && users.length === 0) {
    return <div className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Carregando usuários...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-blue-500/50 transition-colors shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    user.role === 'ADMIN' ? 'bg-blue-900/50 text-blue-400' : 
                    user.role === 'MANAGER' ? 'bg-purple-900/50 text-purple-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{user.name}</h3>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${
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
                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50">Acesso Total</span>
                    ) : user.allowedUnits.length > 0 ? (
                      user.allowedUnits.map(u => (
                        <span key={u} className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">{u}</span>
                      ))
                    ) : (
                      <span className="text-xs text-red-400 italic">Nenhuma loja atribuída</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
              <button 
                onClick={() => handleEdit(user)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(user.id)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* User Modal - Forced z-index and padding to clear header */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-40"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">
                {editingUser.id ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo (Usado no Login)</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                    placeholder="Ex: Mavami"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                  <input
                    type="text"
                    required
                    value={editingUser.email}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                    placeholder="exemplo@mavami.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
                  <input
                    type="password"
                    placeholder={editingUser.id ? "Deixe em branco para manter" : "Senha obrigatória"}
                    value={editingUser.passwordHash}
                    onChange={e => setEditingUser({...editingUser, passwordHash: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Função (Cargo)</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="COLLABORATOR">Colaborador (Apenas Registra)</option>
                    <option value="MANAGER">Gestor (Visualiza Relatórios)</option>
                    <option value="ADMIN">Administrador (Acesso Total)</option>
                  </select>
                </div>
              </div>

              {editingUser.role !== 'ADMIN' && (
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Store size={16} /> Permissões de Loja
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {availableUnits.map(unit => (
                      <label key={unit} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={editingUser.allowedUnits?.includes(unit)}
                          onChange={() => toggleUnitPermission(unit)}
                          className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800 focus:ring-blue-500"
                        />
                        {unit}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title="Excluir Usuário"
        message="Tem certeza que deseja remover este usuário? O histórico de lançamentos dele será mantido."
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