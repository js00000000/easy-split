import React, { useState, useEffect, useMemo } from 'react';
import {
  User as LucideUser, Plus, DollarSign, Receipt, ArrowRight, LogOut, CheckCircle2, X, Edit2, CreditCard, Copy
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  type User 
} from 'firebase/auth';
import {
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';

// --- Types ---

interface Member {
  id: string;
  name: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  bankCode?: string;
  bankAccount?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface UserSettings {
  currentMemberId: string | null;
}

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // 1. Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        console.error("Auth error:", error);
        setAuthError(error.message);
        setAuthLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user) return;

    // Fetch Public Members
    const membersRef = collection(db, 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      // Sort by creation time safely
      membersData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMembers(membersData);
    }, (error) => console.error("Members fetch error:", error));

    // Fetch Public Expenses
    const expensesRef = collection(db, 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      // Sort newest first
      expensesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setExpenses(expensesData);
    }, (error) => console.error("Expenses fetch error:", error));

    // Fetch User's Private Settings (To remember selected member)
    const settingsRef = doc(db, 'users', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentMemberId((docSnap.data() as UserSettings).currentMemberId);
      } else {
        setCurrentMemberId(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Settings fetch error:", error);
      setIsLoading(false);
    });

    return () => {
      unsubMembers();
      unsubExpenses();
      unsubSettings();
    };
  }, [user]);

  // Actions
  const handleSelectMember = async (memberId: string | null) => {
    if (!user) return;
    const settingsRef = doc(db, 'users', user.uid);
    await setDoc(settingsRef, { currentMemberId: memberId }, { merge: true });
  };

  const handleCreateMember = async (name: string) => {
    if (!user || !name.trim()) return;

    // 預先產生新成員的 ID
    const newDocRef = doc(collection(db, 'members'));

    // 不等待伺服器寫入完成，直接在本地端更新並跳轉畫面，避免操作卡頓
    setDoc(newDocRef, {
      name: name.trim(),
      createdAt: serverTimestamp()
    }).catch(err => console.error("Create member error:", err));

    handleSelectMember(newDocRef.id);
  };

  const handleLogoutMember = async () => {
    if (!user) return;
    const settingsRef = doc(db, 'users', user.uid);
    await setDoc(settingsRef, { currentMemberId: null }, { merge: true });
  };

  const handleDeleteMember = async () => {
    if (!user || !currentMemberId) return;
    const memberRef = doc(db, 'members', currentMemberId);
    await deleteDoc(memberRef);
    const settingsRef = doc(db, 'users', user.uid);
    await setDoc(settingsRef, { currentMemberId: null }, { merge: true });
    setIsProfileModalOpen(false);
  };

  const handleUpdateProfile = async (data: Partial<Member>) => {
    if (!user || !currentMemberId) return;
    const memberRef = doc(db, 'members', currentMemberId);
    await updateDoc(memberRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    setIsProfileModalOpen(false);
  };

  const handleAddExpense = async (expenseData: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!user || !currentMemberId) return;

    // 點擊確認後立刻關閉視窗
    setIsExpenseModalOpen(false);

    const expensesRef = collection(db, 'expenses');
    try {
      await addDoc(expensesRef, {
        ...expenseData,
        createdBy: currentMemberId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Add expense error:", error);
    }
  };

  const handleUpdateExpense = async (expenseId: string, expenseData: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!user) return;

    // 點擊確認後立刻關閉視窗與清除編輯狀態
    setIsExpenseModalOpen(false);
    setExpenseToEdit(null);

    const expenseRef = doc(db, 'expenses', expenseId);
    try {
      await updateDoc(expenseRef, {
        ...expenseData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Update expense error:", error);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    // 移除建立者檢查，讓所有人都可以刪除
    if (!user) return;
    if (window.confirm('確定要刪除這筆支出紀錄嗎？')) {
      const expenseRef = doc(db, 'expenses', expense.id);
      await deleteDoc(expenseRef);
    }
  };

  const openAddModal = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  // Auth Error View
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white border-l-4 border-red-500 shadow-sm p-6 rounded-xl max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 text-red-500 rounded-full flex items-center justify-center shrink-0">
              <X className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-gray-900">Firebase 驗證錯誤</h2>
          </div>
          <div className="text-gray-600 text-sm space-y-4">
            <p className="font-mono text-xs bg-gray-100 p-2 rounded text-red-600 break-words">{authError}</p>
            <p>這個錯誤通常是因為您的 Firebase 專案尚未啟用<strong>「匿名登入 (Anonymous)」</strong>所導致的。</p>
            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg">
              <strong className="block mb-2 text-blue-900">請按照以下步驟解決：</strong>
              <ol className="list-decimal ml-4 space-y-1">
                <li>前往您的 Firebase 控制台。</li>
                <li>在左側選單選擇 <strong>Authentication</strong> (驗證)。</li>
                <li>切換到上方 <strong>Sign-in method</strong> (登入方式) 頁籤。</li>
                <li>找到 <strong>Anonymous</strong> (匿名) 並將其<strong>啟用 (Enable)</strong>。</li>
                <li>儲存設定後，重新整理這個網頁。</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Derived State
  const currentMember = members.find(m => m.id === currentMemberId);

  // Routing Logic
  if (!currentMemberId || !currentMember) {
    return <OnboardingView members={members} onSelect={handleSelectMember} onCreate={handleCreateMember} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Receipt className="w-6 h-6" />
            <h1 className="font-semibold text-lg">群組分帳</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
              title="個人設定"
            >
              <LucideUser className="w-4 h-4" />
              <span>{currentMember.name}</span>
            </button>
            <button onClick={handleLogoutMember}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="切換使用者">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BalancesView members={members} expenses={expenses} currentMemberId={currentMemberId} />

        <ExpensesList expenses={expenses} members={members} onEdit={openEditModal}
          onDelete={handleDeleteExpense} />
      </main>

      {/* Floating Action Button (Mobile) & Fixed Button (Desktop) */}
      <div className="fixed bottom-6 right-6 z-20">
        <button onClick={openAddModal}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2">
          <Plus className="w-6 h-6" />
          <span className="hidden md:inline font-medium pr-2">新增支出</span>
        </button>
      </div>

      {isExpenseModalOpen && (
        <ExpenseModal 
          members={members} 
          currentMemberId={currentMemberId} 
          initialData={expenseToEdit} 
          onClose={() => {
            setIsExpenseModalOpen(false);
            setExpenseToEdit(null);
          }}
          onSave={(data, id) => {
            if (id) {
              handleUpdateExpense(id, data);
            } else {
              handleAddExpense(data);
            }
          }}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal 
          currentMember={currentMember} 
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleUpdateProfile}
          onDelete={handleDeleteMember}
        />
      )}
    </div>
  );
}

// --- Components ---

function OnboardingView({ members, onSelect, onCreate }: { 
  members: Member[], 
  onSelect: (id: string) => void, 
  onCreate: (name: string) => void 
}) {
  const [newName, setNewName] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 space-y-8">
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">歡迎使用群組分帳</h1>
          <p className="text-gray-500 text-sm">請選擇你的身分，或建立新成員</p>
        </div>

        <div className="space-y-6">
          {members.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-700">選擇既有成員：</h2>
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => (
                  <button key={m.id} onClick={() => onSelect(m.id)}
                    className="p-3 border rounded-xl text-left hover:border-indigo-600 hover:bg-indigo-50
                    transition-colors"
                  >
                    <div className="font-medium text-gray-900 truncate">{m.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或</span>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onCreate(newName); }}
            className="space-y-3"
          >
            <h2 className="text-sm font-medium text-gray-700">建立新成員：</h2>
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="輸入你的名字"
                className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                focus:border-transparent outline-none"
                required
              />
              <button type="submit" disabled={!newName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                進入
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BalancesView({ members, expenses, currentMemberId }: { 
  members: Member[], 
  expenses: Expense[], 
  currentMemberId: string 
}) {
  const { balances, settlements } = useMemo(() => {
    // 1. Calculate raw balances (positive = gets money back, negative = owes money)
    const map: Record<string, number> = {};
    members.forEach(m => map[m.id] = 0);

    expenses.forEach(exp => {
      // Payer gets the full amount added to their balance
      if (map[exp.paidBy] !== undefined) {
        map[exp.paidBy] += parseFloat(exp.amount.toString());
      }
      // Splitters subtract their share
      if (exp.splitAmong && exp.splitAmong.length > 0) {
        const splitAmt = parseFloat(exp.amount.toString()) / exp.splitAmong.length;
        exp.splitAmong.forEach(mId => {
          if (map[mId] !== undefined) {
            map[mId] -= splitAmt;
          }
        });
      }
    });

    // 2. Compute settlements (Greedy algorithm to settle debts)
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(map).forEach(([id, amt]) => {
      if (amt < -0.01) debtors.push({ id, amount: Math.abs(amt) }); 
      else if (amt > 0.01) creditors.push({ id, amount: amt });
    });

    // Sort to optimize matching (largest debts first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions: { from: string, to: string, amount: number }[] = [];
    let d = 0;
    let c = 0;

    const debtors_copy = debtors.map(x => ({ ...x }));
    const creditors_copy = creditors.map(x => ({ ...x }));

    while (d < debtors_copy.length && c < creditors_copy.length) { 
      const debtor = debtors_copy[d]; 
      const creditor = creditors_copy[c]; 
      const amount = Math.min(debtor.amount, creditor.amount); 
      transactions.push({ from: debtor.id, to: creditor.id, amount: amount }); 
      debtor.amount -= amount; 
      creditor.amount -= amount; 
      if (debtor.amount < 0.01) d++; 
      if (creditor.amount < 0.01) c++; 
    } 
    return { balances: map, settlements: transactions }; 
  }, [members, expenses]);

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

function ExpensesList({ expenses, members, onEdit, onDelete }: { 
  expenses: Expense[], 
  members: Member[], 
  onEdit: (exp: Expense) => void,
  onDelete: (exp: Expense) => void
}) {
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || '未知';

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
        <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h3 className="text-gray-900 font-medium mb-1">尚無支出紀錄</h3>
        <p className="text-gray-500 text-sm">點擊右下角按鈕新增第一筆群組支出</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50/50">
        <h2 className="font-semibold text-gray-900">支出明細</h2>
      </div>
      <div className="divide-y">
        {expenses.map(exp => {
          return (
            <div key={exp.id} className="p-5 flex items-start justify-between group">
              <div>
                <h3 className="font-medium text-gray-900">{exp.description}</h3>
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
    </div>
  );
}

function ExpenseModal({ members, currentMemberId, initialData, onClose, onSave }: { 
  members: Member[], 
  currentMemberId: string,
  initialData: Expense | null,
  onClose: () => void,
  onSave: (data: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>, id?: string) => void
}) {
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

function ProfileModal({ currentMember, onClose, onSave, onDelete }: { 
  currentMember: Member, 
  onClose: () => void, 
  onSave: (data: Partial<Member>) => void,
  onDelete: () => void
}) {
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

  const handleDelete = () => {
    if (window.confirm('確定要刪除此成員嗎？這將會從群組中移除你的身分。')) {
      onDelete();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">個人設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
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
              <input type="text" value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                placeholder="代碼 (如: 822)"
                className="w-1/3 px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600
                focus:border-transparent outline-none font-mono text-sm"
              />
              <div className="relative flex-1">
                <CreditCard
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
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

          <div className="pt-4 mt-2 border-t space-y-3">
            <button type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              儲存設定
            </button>
            <button type="button" onClick={handleDelete}
              className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              刪除此成員身分
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
