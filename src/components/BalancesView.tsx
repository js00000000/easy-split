import { useMemo, useState } from 'react';
import { DollarSign, CheckCircle2, ArrowRight, CreditCard, Copy } from 'lucide-react';
import type { Member, Expense } from '../types';
import { calculateBalancesAndSettlements } from '../lib/settlement';

interface BalancesViewProps {
  members: Member[];
  expenses: Expense[];
  currentMemberId: string;
}

export function BalancesView({ members, expenses, currentMemberId }: BalancesViewProps) {
  const { balances, settlements } = useMemo(() => {
    const { balances: map, settlements: transactions } = calculateBalancesAndSettlements(members, expenses);

    // Sort settlements: current member as payer first
    transactions.sort((a, b) => {
      if (a.from === currentMemberId) return -1;
      if (b.from === currentMemberId) return 1;
      return 0;
    });

    return { balances: map, settlements: transactions }; 
  }, [members, expenses, currentMemberId]);

  const myBalance = balances[currentMemberId] || 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">我的結算狀態</p>
            {Math.abs(myBalance) < 0.01 ? (
              <p className="text-2xl font-bold text-green-600">已結清</p>
            ) : myBalance > 0 ? (
              <p className="text-2xl font-bold text-indigo-600">
                需收回 <span className="text-lg">$</span>{myBalance.toFixed(0)}
              </p>
            ) : (
              <p className="text-2xl font-bold text-red-500">
                需支付 <span className="text-lg">$</span>{Math.abs(myBalance).toFixed(0)}
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-sm text-gray-500 mb-3">總結算建議</p>
          {settlements.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-400 py-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>目前沒有未結款項</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {settlements.map((s, idx) => (
                <SettlementRow key={idx} settlement={s} members={members} currentMemberId={currentMemberId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettlementRow({ settlement, members, currentMemberId }: { 
  settlement: { from: string, to: string, amount: number }, 
  members: Member[], 
  currentMemberId: string 
}) {
  const [copied, setCopied] = useState(false);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || '未知';
  const toMember = members.find(m => m.id === settlement.to);
  const isPayer = settlement.from === currentMemberId;
  const isReceiver = settlement.to === currentMemberId;

  const displayAccount = toMember?.bankCode ? `(${toMember.bankCode}) ${toMember?.bankAccount}` :
    (toMember?.bankAccount || '');

  const handleCopy = () => {
    const text = toMember?.bankAccount || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="py-2 border-b last:border-0 border-gray-50">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={isPayer ? 'font-bold text-red-600' : 'text-gray-700'}>
            {getMemberName(settlement.from)}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className={isReceiver ? 'font-bold text-indigo-600' : 'text-gray-700'}>
            {getMemberName(settlement.to)}
          </span>
        </div>
        <span className="font-medium font-mono">${settlement.amount.toFixed(0)}</span>
      </div>

      {isPayer && (toMember?.bankAccount || toMember?.bankCode) && (
        <div
          className="mt-2 flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-600 font-mono truncate">
            <CreditCard className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <span className="truncate" title={displayAccount}>{displayAccount}</span>
          </div>
          <button onClick={handleCopy}
            className="shrink-0 ml-2 text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-colors flex items-center gap-1">
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span
                  className="text-[10px] text-green-600 font-medium hidden sm:inline">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /><span
                  className="text-[10px] font-medium hidden sm:inline">複製</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
