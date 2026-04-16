import { useState } from 'react';
import { Users, LogOut, Clock, ArrowRight, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import type { Group } from '../types';

interface GroupSelectionViewProps {
  user: User | null;
  myGroups: Group[];
  onGoogleLogin: () => void;
  onLogout: () => void;
  onCreateGroup: (name: string) => void;
  onJoinGroup: (id: string) => void;
  onSelectGroup: (id: string) => void;
}

export function GroupSelectionView({ 
  user, 
  myGroups, 
  onGoogleLogin, 
  onLogout, 
  onCreateGroup, 
  onJoinGroup, 
  onSelectGroup 
}: GroupSelectionViewProps) {
  const { t, i18n } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [groupIdToJoin, setGroupIdToJoin] = useState('');
  const isAnonymous = user?.isAnonymous;

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex flex-col items-center mb-4">
            <span className="text-xs font-black tracking-tighter uppercase text-indigo-400 leading-none mb-1">Slice</span>
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.login_title')}</h1>
          <p className="text-gray-500 text-sm">{t('groups.no_groups')}</p>
        </div>

        <div className="space-y-6">
          {/* Auth Status */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-indigo-200" />
              ) : (
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                  {user?.displayName?.[0] || user?.email?.[0] || '?'}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-900 truncate">
                  {isAnonymous ? (i18n.language.startsWith('zh') ? '訪客' : 'Guest') : (user?.displayName || user?.email || t('common.loading'))}
                </span>
                {isAnonymous && <button onClick={onGoogleLogin} className="text-[10px] text-indigo-600 text-left hover:underline">{t('auth.google_login')}</button>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleLanguage} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Change Language">
                <Languages className="w-4 h-4" />
              </button>
              <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {myGroups.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" /> {t('groups.my_groups')}
                </h2>
                <div className="space-y-2">
                  {myGroups.map(g => (
                    <button 
                      key={g.id} 
                      onClick={() => onSelectGroup(g.id)}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-medium text-gray-900 truncate">{g.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{g.id.slice(0, 12)}...</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                    </button>
                  ))}
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

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700">{t('groups.create_new')}</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={groupName} 
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t('groups.enter_name')}
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                />
                <button 
                  onClick={() => onCreateGroup(groupName)}
                  disabled={!groupName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors text-sm whitespace-nowrap"
                >
                  {t('groups.create')}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-bold text-gray-700">{t('groups.join_existing')}</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={groupIdToJoin} 
                  onChange={(e) => setGroupIdToJoin(e.target.value)}
                  placeholder={t('groups.enter_id')}
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-mono"
                />
                <button 
                  onClick={() => onJoinGroup(groupIdToJoin)}
                  disabled={!groupIdToJoin.trim()}
                  className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-50 transition-colors text-sm whitespace-nowrap"
                >
                  {t('groups.join')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
