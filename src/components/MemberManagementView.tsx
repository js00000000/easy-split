import { useMemo, useState } from 'react';
import { ArrowLeft, Users, Shield, X, Plus, Copy, Trash2, Share2, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { APP_NAME } from '../constants';
import type { Member, Group, Expense } from '../types';
import { calculateBalancesAndSettlements } from '../lib/settlement';
import { useDialog } from '../contexts/DialogContext';

interface MemberManagementViewProps {
  members: Member[];
  expenses: Expense[];
  currentMember: Member;
  currentGroup: Group | null;
  onBack: () => void;
  onDeleteMember: (id: string) => void;
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
  onUpdateGroupName,
  onDeleteGroup,
  onCreateMember
}: MemberManagementViewProps) {
  const { t, i18n } = useTranslation();
  const { confirm } = useDialog();
  const [newName, setNewName] = useState(currentGroup?.name || '');
  const [newMemberName, setNewMemberName] = useState('');
  const { balances } = useMemo(() => calculateBalancesAndSettlements(members, expenses), [members, expenses]);

  const handleSaveGroupName = async () => {
    if (newName.trim() && newName !== currentGroup?.name) {
      onUpdateGroupName(newName);
      toast.success(t('common.success'));
    }
  };

  const handleDeleteMemberByHost = async (member: Member) => {
    const balance = balances[member.id] || 0;
    if (Math.abs(balance) > 0.01) {
      const balanceStr = balance > 0 
        ? t('members.receivable', { amount: balance.toFixed(0) }) 
        : t('members.owe', { amount: Math.abs(balance).toFixed(0) });
      toast.error(t('members.error_unsettled', { name: member.name, balance: balanceStr }));
      return;
    }
    const isConfirmed = await confirm(t('members.delete_member_msg', { name: member.name }));
    if (isConfirmed) {
      onDeleteMember(member.id);
      toast.success(t('common.success'));
    }
  };

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      onCreateMember(newMemberName.trim());
      setNewMemberName('');
      toast.success(t('common.success'));
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[10px] font-black tracking-tighter uppercase text-indigo-400 leading-none">{APP_NAME}</span>
              <h1 className="font-semibold text-lg leading-tight">{t('members.title')}</h1>
            </div>
          </div>
          <button
            onClick={toggleLanguage}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
            title={i18n.language.startsWith('zh') ? 'Switch to English' : '切換至繁體中文'}
          >
            <Languages className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> {t('members.list')}
            </h2>
            <span className="text-xs text-gray-500">
              {t('members.count', { count: members.length })}
            </span>
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
                        {m.id === currentMember.id && <span className="text-[10px] text-indigo-500 font-normal">({t('members.you')})</span>}
                        {m.isHost && <Shield className="w-3 h-3 text-amber-500" />}
                      </span>
                      <span className={`text-xs ${Math.abs(balance) < 0.01 ? 'text-green-500' : balance > 0 ? 'text-indigo-500' : 'text-red-500'}`}>
                        {Math.abs(balance) < 0.01 
                          ? t('members.settled') 
                          : balance > 0 
                            ? t('members.receivable', { amount: balance.toFixed(0) }) 
                            : t('members.owe', { amount: Math.abs(balance).toFixed(0) })
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isClaimedByOthers && <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{t('members.claimed')}</div>}
                    {m.id !== currentMember.id && currentMember.isHost && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMemberByHost(m)}
                        disabled={!canDelete}
                        className={`p-2 rounded-lg transition-colors ${canDelete
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-gray-300 cursor-not-allowed'
                          }`}
                        title={!canDelete ? (i18n.language.startsWith('zh') ? "餘額未結清" : "Balance not settled") : t('members.delete_member')}
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
                  placeholder={t('members.enter_name')}
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
                  {t('common.add')}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" /> {t('groups.group_info')}
          </h2>
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">{t('groups.group_name')}</span>
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
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium">{currentGroup?.name}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('groups.group_id')}</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{currentGroup?.id}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentGroup?.id || '');
                    toast.success(t('groups.id_copied'));
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  title={t('common.copy')}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">{t('common.share')}</span>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/join/${currentGroup?.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success(t('groups.link_copied'));
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                {t('groups.share_link')}
              </button>
            </div>
          </div>
        </section>

        {currentMember.isHost && (
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" /> {t('groups.danger_zone')}
            </h2>
            <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-red-600">{t('groups.delete_group')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('groups.delete_group_msg', { name: currentGroup?.name })}</p>
              </div>
              <button type="button" onClick={onDeleteGroup}
                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" />
                {t('groups.delete_group')}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
