import { useState } from 'react';
import { X, User as LucideUser, CreditCard, Users, Shield } from 'lucide-react';
import type { Member } from '../types';

interface ProfileModalProps {
  currentMember: Member;
  onClose: () => void;
  onSave: (data: Partial<Member>) => void;
  onManageMembers: () => void;
}

export function ProfileModal({ 
  currentMember, 
  onClose, 
  onSave, 
  onManageMembers
}: ProfileModalProps) {
  const [name, setName] = useState(currentMember.name || '');
  const [bankCode, setBankCode] = useState(currentMember.bankCode || '');
  const [bankAccount, setBankAccount] = useState(currentMember.bankAccount || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      bankCode: bankCode.trim(),
      bankAccount: bankAccount.trim()
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">個人設定</h2>
            {currentMember.isHost && (
              <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> 主持人
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顯示名稱</label>
              <div className="relative">
                <LucideUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="輸入你的名字"
                  className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                  focus:border-transparent outline-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">收款銀行資訊</label>
              <div className="flex gap-2">
                <input 
                  type="tel" 
                  value={bankCode} 
                  onChange={(e) => setBankCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="代碼 (如: 822)"
                  className="w-1/3 px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                  focus:border-transparent outline-none font-mono text-sm"
                />
                <div className="relative flex-1">
                  <CreditCard
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="tel" 
                    value={bankAccount} 
                    onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
                    placeholder="銀行帳號 (如: 1234567890)"
                    className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                    focus:border-transparent outline-none font-mono text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                設定後，其他人需要還你錢時，就會看到這個帳號並可一鍵複製。
              </p>
            </div>

            <button type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              儲存設定
            </button>
          </div>

          {currentMember.isHost && (
            <div className="pt-4 mt-2 border-t">
              <button 
                type="button" 
                onClick={onManageMembers}
                className="w-full py-3 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                成員與群組管理
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
