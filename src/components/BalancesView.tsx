import { useMemo } from 'react';
import { DollarSign, CheckCircle2, ArrowRight, CreditCard, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Member, Expense } from '../types';
import { calculateBalancesAndSettlements } from '../lib/settlement';
import { formatCurrency, toAmountDisplay } from '../utils/format';

interface BalancesViewProps {
  members: Member[];
  expenses: Expense[];
  currentMemberId: string;
}

export function BalancesView({ members, expenses, currentMemberId }: BalancesViewProps) {
  const { t } = useTranslation();
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
            <p className="text-sm text-gray-500 mb-1">{t('balances.net_balance')}</p>
            {Math.abs(myBalance) < 0.01 ? (
              <p className="text-2xl font-bold text-green-600">{t('members.settled')}</p>
            ) : myBalance > 0 ? (
              <p className="text-2xl font-bold text-indigo-600">
                {t('members.receivable', { amount: toAmountDisplay(myBalance) })}
              </p>
            ) : (
              <p className="text-2xl font-bold text-red-500">
                {t('members.owe', { amount: toAmountDisplay(Math.abs(myBalance)) })}
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-sm text-gray-500 mb-3">{t('balances.settlements')}</p>
          {settlements.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-400 py-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('balances.no_expenses')}</span>
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
  const { t } = useTranslation();
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || t('common.loading');
  const toMember = members.find(m => m.id === settlement.to);
  const isPayer = settlement.from === currentMemberId;
  const isReceiver = settlement.to === currentMemberId;

  const displayAccount = toMember?.bankCode ? `(${toMember.bankCode}) ${toMember?.bankAccount}` :
    (toMember?.bankAccount || '');

  const handleCopy = () => {
    const text = toMember?.bankAccount || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success(t('profile.bank_copied')))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
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
      toast.success(t('profile.bank_copied'));
    } catch (err) {
      console.error('Unable to copy', err);
      toast.error(t('common.error'));
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
        <span className="font-medium font-mono">{formatCurrency(settlement.amount)}</span>
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
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium hidden sm:inline">{t('common.copy')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
