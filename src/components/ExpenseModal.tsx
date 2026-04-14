import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import type { Member, Expense } from '../types';

interface ExpenseModalProps {
  members: Member[];
  currentMemberId: string;
  initialData: Expense | null;
  onClose: () => void;
  onSave: (data: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>, id?: string) => void;
}

export function ExpenseModal({ members, currentMemberId, initialData, onClose, onSave }: ExpenseModalProps) {
  const [description, setDescription] = useState(initialData ? initialData.description : '');
  const [amount, setAmount] = useState(initialData ? initialData.amount.toString() : '');
  const [paidBy, setPaidBy] = useState(initialData ? initialData.paidBy : currentMemberId);
  const [splitAmong, setSplitAmong] = useState<string[]>(initialData ? initialData.splitAmong : members.map(m => m.id));

  const isEditing = !!initialData;
  const isAllSelected = members.length > 0 && splitAmong.length === members.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || splitAmong.length === 0) return;

    onSave({
      description: description.trim(),
      amount: parseFloat(amount),
      paidBy,
      splitAmong
    }, initialData?.id);
  };

  const toggleSplitMember = (id: string) => {
    setSplitAmong(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{isEditing ? '編輯支出' : '新增支出'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用途</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：晚餐、計程車"
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input type="number" min="0" step="any" value={amount} onChange={(e) =>
                  setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                  focus:border-transparent outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">付款人 (誰先墊錢)</label>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                focus:border-transparent outline-none bg-white"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">參與分帳的成員</label>
                <button type="button" onClick={() => setSplitAmong(isAllSelected ? [] : members.map(m =>
                  m.id))}
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
                >
                  {isAllSelected ? '全不選' : '全選'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const isSelected = splitAmong.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleSplitMember(m.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm
                      transition-colors text-left ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                        {isSelected &&
                          <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className="truncate">{m.name}</span>
                    </button>
                  );
                })}
              </div>
              {splitAmong.length === 0 && (
                <p className="text-red-500 text-xs mt-1">請至少選擇一位分帳成員</p>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t">
            <button type="submit" disabled={!description || !amount || splitAmong.length === 0}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors">
              {isEditing ? '儲存修改' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
