import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';

export function MemberSelectionPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { members, currentGroup, handleSelectMember, handleCreateMember } = useGroup();
  const [newName, setNewName] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black tracking-tighter uppercase text-indigo-400 leading-none mb-1">Slice</span>
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{currentGroup?.name}</h1>
          <p className="text-gray-500 text-sm">{t('members.select_identity')}</p>
        </div>

        <div className="space-y-6">
          {members.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
                  <span className="px-2 bg-white text-gray-400">{t('members.select_existing')}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const isClaimedByOthers = m.userId && m.userId !== user?.uid;
                  const isMe = m.userId === user?.uid;
                  
                  return (
                    <button 
                      key={m.id} 
                      onClick={() => !isClaimedByOthers && handleSelectMember(m.id)}
                      disabled={!!isClaimedByOthers}
                      className={`p-3 border rounded-xl text-left transition-all ${
                        isMe 
                          ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                          : isClaimedByOthers 
                            ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed' 
                            : 'hover:border-indigo-600 hover:bg-indigo-50 border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-gray-900 truncate flex items-center gap-1">
                        {m.name}
                        {isMe && <CheckCircle2 className="w-3 h-3 text-indigo-600" />}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {isMe ? t('members.you') : isClaimedByOthers ? t('members.claimed') : t('members.not_claimed')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
              <span className="px-2 bg-white text-gray-400">OR</span>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateMember(newName); }}
            className="space-y-3"
          >
            <h2 className="text-sm font-medium text-gray-700">{t('members.or_create')}:</h2>
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={t('profile.display_name')}
                className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                focus:border-transparent outline-none text-sm"
                required
              />
              <button type="submit" disabled={!newName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors text-sm">
                {t('common.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
