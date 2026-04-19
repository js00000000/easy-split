import { useState, useMemo } from 'react';
import {
  Receipt, User as LucideUser, LayoutGrid, Plus, Share2, Languages
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { APP_NAME } from '../constants';
import type { Expense } from '../types';
import { BalancesView } from '../components/BalancesView';
import { ExpensesList } from '../components/ExpensesList';
import { ExpenseModal } from '../components/ExpenseModal';
import { ProfileModal } from '../components/ProfileModal';
import { useGroup } from '../contexts/GroupContext';
import { useAuth } from '../contexts/AuthContext';

export function GroupDashboardPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { handleLogout } = useAuth();
  const {
    groupId,
    currentGroup,
    members,
    expenses,
    currentMemberId,
    currentMember,
    handleUpdateProfile,
    handleAddExpense,
    handleUpdateExpense,
    handleDeleteExpense,
  } = useGroup();

  // Internal UI State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [filterPaidBy, setFilterPaidBy] = useState<string | null>(null);

  const filteredExpenses = useMemo(() => {
    if (!filterPaidBy) return expenses;
    return expenses.filter(exp => exp.paidBy === filterPaidBy);
  }, [expenses, filterPaidBy]);

  const openAddModal = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(newLang);
  };

  if (!currentMember || !groupId) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 md:pb-8">
      <Helmet>
        <title>{currentGroup?.name ? `${currentGroup.name} - ${APP_NAME}` : `Group Dashboard - ${APP_NAME}`}</title>
        <meta property="og:title" content={currentGroup?.name ? `${currentGroup.name} - ${APP_NAME}` : `Group Dashboard - ${APP_NAME}`} />
        <meta property="twitter:title" content={currentGroup?.name ? `${currentGroup.name} - ${APP_NAME}` : `Group Dashboard - ${APP_NAME}`} />
      </Helmet>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Receipt className="w-5 h-5" />
              <span className="text-xs font-black tracking-tighter uppercase text-indigo-400">{APP_NAME}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
              title={t('profile.title')}
            >
              <LucideUser className="w-4 h-4" />
              <span className="max-w-[80px] truncate">{currentMember.name}</span>
            </button>
            <button
              onClick={toggleLanguage}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title={t('common.switch_lang')}
            >
              <Languages className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title={t('groups.my_groups')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {currentGroup?.name || 'Group Dashboard'}
            </h1>
            <p className="text-sm text-gray-500">
              {expenses.length} {t('expenses.title')}
            </p>
          </div>
          <button
            onClick={() => {
              const url = `${window.location.origin}/join/${groupId}`;
              navigator.clipboard.writeText(url);
              toast.success(t('groups.link_copied'));
            }}
            className="flex items-center gap-2 px-3 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"
            title={t('common.share')}
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">{t('common.share')}</span>
          </button>
        </div>

        <BalancesView members={members} expenses={expenses} currentMemberId={currentMemberId!} />

        <ExpensesList
          expenses={filteredExpenses}
          members={members}
          onEdit={openEditModal}
          onDelete={async (expense) => {
            await handleDeleteExpense(expense);
          }}
          filterPaidBy={filterPaidBy}
          onFilterChange={setFilterPaidBy}
        />
      </main>

      {/* Floating Action Button (Mobile) & Fixed Button (Desktop) */}
      <div className="fixed bottom-6 right-6 z-20">
        <button onClick={openAddModal}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2">
          <Plus className="w-6 h-6" />
          <span className="hidden md:inline font-medium pr-2">{t('expenses.add_new')}</span>
        </button>
      </div>

      {isExpenseModalOpen && (
        <ExpenseModal
          members={members}
          currentMemberId={currentMemberId!}
          initialData={expenseToEdit}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setExpenseToEdit(null);
          }}
          onSave={async (data, id) => {
            if (id) {
              await handleUpdateExpense(id, data);
              toast.success(t('expenses.updated'));
            } else {
              await handleAddExpense(data);
              toast.success(t('expenses.added'));
            }
            setIsExpenseModalOpen(false);
            setExpenseToEdit(null);
          }}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal
          currentMember={currentMember}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={async (data) => {
            await handleUpdateProfile(data);
            setIsProfileModalOpen(false);
          }}
          onManageMembers={() => {
            setIsProfileModalOpen(false);
            navigate(`/group/${groupId}/members`);
          }}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
