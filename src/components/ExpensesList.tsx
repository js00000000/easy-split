import { Receipt, Edit2, X } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { Member, Expense } from '../types';

interface ExpensesListProps {
  expenses: Expense[];
  members: Member[];
  onEdit: (exp: Expense) => void;
  onDelete: (exp: Expense) => void;
  filterPaidBy: string | null;
  onFilterChange: (id: string | null) => void;
}

export function ExpensesList({ expenses, members, onEdit, onDelete, filterPaidBy, onFilterChange }: ExpensesListProps) {
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || '未知';
  
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">支出明細</h2>
        
        {/* Filter Selection */}
        <div className="flex items-center gap-2">
          <label htmlFor="payer-filter" className="text-xs text-gray-500">付款人:</label>
          <select
            id="payer-filter"
            value={filterPaidBy || ''}
            onChange={(e) => onFilterChange(e.target.value || null)}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-600 outline-none"
          >
            <option value="">全部</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="p-10 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-medium mb-1">
            {filterPaidBy ? '查無符合的支出' : '尚無支出紀錄'}
          </h3>
          <p className="text-gray-500 text-sm">
            {filterPaidBy ? '試著切換篩選對象或清除篩選' : '點擊右下角按鈕新增第一筆群組支出'}
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {expenses.map(exp => {
            return (
              <div key={exp.id} className="p-5 flex items-start justify-between group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{exp.description}</h3>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {formatDate(exp.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                    <p>
                      <span className="font-medium">{getMemberName(exp.paidBy)}</span> 先付了
                      <span className="font-medium text-gray-900 mx-1">${exp.amount}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      分帳成員: {exp.splitAmong.map(getMemberName).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(exp)}
                    className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50
                    transition-colors"
                    title="編輯此紀錄"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(exp)}
                    className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50
                    transition-colors"
                    title="刪除此紀錄"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
