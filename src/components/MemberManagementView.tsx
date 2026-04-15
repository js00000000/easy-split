import { useMemo, useState } from 'react';
import { ArrowLeft, Users, Shield, X, Plus, Copy, Trash2, DollarSign } from 'lucide-react';
import type { Member, Group, Expense } from '../types';
import { calculateBalancesAndSettlements } from '../lib/settlement';

interface MemberManagementViewProps {
  members: Member[];
  expenses: Expense[];
  currentMember: Member;
  currentGroup: Group | null;
  onBack: () => void;
  onDeleteMember: (id: string) => void;
  onDeleteAllExpenses: () => void;
  onUpdateGroupName: (name: string) => void;
  onDeleteGroup: () => void;
  onCreateMember: (name: string) => void;
}

export function MemberManagementView({
  members,
  expenses,
  currentMember,
  currentGroup,
  onBack,
  onDeleteMember,
  onDeleteAllExpenses,
  onUpdateGroupName,
  onDeleteGroup,
  onCreateMember
}: MemberManagementViewProps) {
  const [newName, setNewName] = useState(currentGroup?.name || '');
  const [newMemberName, setNewMemberName] = useState('');
  const { balances } = useMemo(() => calculateBalancesAndSettlements(members, expenses), [members, expenses]);

  const handleSaveGroupName = () => {
    if (newName.trim() && newName !== currentGroup?.name) {
      onUpdateGroupName(newName);
      alert('群組名稱已更新');
    }
  };

  const handleDeleteMemberByHost = (member: Member) => {
    const balance = balances[member.id] || 0;
    if (Math.abs(balance) > 0.01) {
      alert(`無法刪除成員「${member.name}」，因為該成員還有未結清的款項 (${balance > 0 ? '需收回' : '需支付'} $${Math.abs(balance).toFixed(0)})。`);
      return;
    }
    if (window.confirm(`確定要刪除成員「${member.name}」嗎？此操作不可復原。`)) {
      onDeleteMember(member.id);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('確定要刪除「所有」支出紀錄嗎？此操作不可復原。')) {
      onDeleteAllExpenses();
    }
  };

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      onCreateMember(newMemberName.trim());
      setNewMemberName('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">成員與管理</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> 成員名單
            </h2>
            <span className="text-xs text-gray-500">{members.length} 位成員</span>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden divide-y divide-gray-100">
            {members.map(m => {
              const balance = balances[m.id] || 0;
              const canDelete = Math.abs(balance) < 0.01 && m.id !== currentMember.id;
              const isClaimedByOthers = m.userId && m.userId !== currentMember.userId;

              return (
                <div key={m.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                      {m.name[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 flex items-center gap-1">
                        {m.name}
                        {m.id === currentMember.id && <span className="text-[10px] text-indigo-500 font-normal">(你自己)</span>}
                        {m.isHost && <Shield className="w-3 h-3 text-amber-500" />}
                      </span>
                      <span className={`text-xs ${Math.abs(balance) < 0.01 ? 'text-green-500' : balance > 0 ? 'text-indigo-500' : 'text-red-500'}`}>
                        {Math.abs(balance) < 0.01 ? '已結清' : `${balance > 0 ? '待收回' : '待支付'} $${Math.abs(balance).toFixed(0)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isClaimedByOthers && <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">已綁定</div>}
                    {m.id !== currentMember.id && currentMember.isHost && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMemberByHost(m)}
                        disabled={!canDelete}
                        className={`p-2 rounded-lg transition-colors ${
                          canDelete 
                            ? 'text-red-500 hover:bg-red-50' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={!canDelete ? "餘額未結清" : "刪除成員"}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {currentMember.isHost && (
            <div className="bg-white rounded-2xl border shadow-sm p-4 mt-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="新增成員姓名"
                  value={newMemberName} 
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                  className="flex-1 px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                />
                <button 
                  onClick={handleAddMember}
                  disabled={!newMemberName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" /> 群組資訊
          </h2>
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">群組名稱</span>
              {currentMember.isHost ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                  />
                  <button 
                    onClick={handleSaveGroupName}
                    disabled={!newName.trim() || newName === currentGroup?.name}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    儲存
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium">{currentGroup?.name}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">群組 ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{currentGroup?.id}</code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(currentGroup?.id || '');
                    alert('已複製群組 ID');
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {currentMember.isHost && (
              <div className="pt-4 mt-2 border-t flex items-center justify-between">
                <span className="text-sm text-red-600 font-medium">刪除此群組</span>
                <button 
                  onClick={onDeleteGroup}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除
                </button>
              </div>
            )}
          </div>
        </section>

        {currentMember.isHost && (
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" /> 危險區域
            </h2>
            <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">刪除所有支出紀錄</h3>
                <p className="text-xs text-gray-500 mt-1">此操作將永久清除群組內的所有帳務資料，不可復原。</p>
              </div>
              <button type="button" onClick={handleDeleteAll}
                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
                立即刪除所有紀錄
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
