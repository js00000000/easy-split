import React, { useState, useEffect, useMemo } from 'react';
import {
  User as LucideUser, Plus, DollarSign, Receipt, ArrowRight, LogOut, CheckCircle2, X, Edit2, CreditCard, Copy, Shield, Users, ArrowLeft, Clock, Trash2
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User 
} from 'firebase/auth';
import {
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  documentId
} from 'firebase/firestore';
import { db, auth, googleProvider } from './lib/firebase';
import { calculateBalancesAndSettlements } from './lib/settlement';

// --- Types ---

interface Member {
  id: string;
  name: string;
  userId?: string; // Binds to a Firebase User UID
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  bankCode?: string;
  bankAccount?: string;
  isHost?: boolean;
}

interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
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
  lastGroupId: string | null;
  joinedGroupIds?: string[];
  currentMemberId?: string | null;
}

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [groupId, setGroupId] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [filterPaidBy, setFilterPaidBy] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'members'>('dashboard');

  // 1. Auth Setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        setAuthLoading(false);
      } else {
        // If not logged in, sign in anonymously by default
        signInAnonymously(auth).catch((error) => {
          console.error("Auth error:", error);
          setAuthError(error.message);
          setAuthLoading(false);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching - Step 1: User Settings
  useEffect(() => {
    if (!user) return;

    const settingsRef = doc(db, 'users', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        setGroupId(data.lastGroupId || null);
        
        // Step 1.5: Fetch metadata for all joined groups
        if (data.joinedGroupIds && data.joinedGroupIds.length > 0) {
          const groupsQuery = query(
            collection(db, 'groups'), 
            where(documentId(), 'in', data.joinedGroupIds.slice(0, 30)) // Firestore 'in' limit is 30
          );
          getDocs(groupsQuery).then(snapshot => {
            const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
            setMyGroups(groupsData);
          }).catch(err => console.error("Fetch my groups error:", err));
        } else {
          setMyGroups([]);
        }
      } else {
        setGroupId(null);
        setMyGroups([]);
      }
    }, (error) => {
      console.error("Settings fetch error:", error);
      setIsLoading(false);
    });

    return () => unsubSettings();
  }, [user]);

  // 3. Data Fetching - Step 2: Group Specific Data
  useEffect(() => {
    if (!user || !groupId) {
      if (!user) {
        // Still waiting for auth
      } else {
        // No group selected, stop loading
        setIsLoading(false);
      }
      setMembers([]);
      setExpenses([]);
      setCurrentGroup(null);
      setCurrentMemberId(null);
      return;
    }

    setIsLoading(true);

    // Fetch Group Metadata
    const groupRef = doc(db, 'groups', groupId);
    const unsubGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentGroup({ id: docSnap.id, ...docSnap.data() } as Group);
      } else {
        console.error("Group not found");
        setGroupId(null); // Reset if group doesn't exist
      }
    });

    // Fetch Members in Group
    const membersRef = collection(db, 'groups', groupId, 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      membersData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMembers(membersData);

      // Auto-identify current member based on user binding
      const myMember = membersData.find(m => m.userId === user.uid);
      if (myMember) {
        setCurrentMemberId(myMember.id);
      } else {
        setCurrentMemberId(null);
      }
      
      setIsLoading(false);
    }, (error) => {
      console.error("Members fetch error:", error);
      setIsLoading(false);
    });

    // Fetch Expenses in Group
    const expensesRef = collection(db, 'groups', groupId, 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      expensesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setExpenses(expensesData);
    }, (error) => console.error("Expenses fetch error:", error));

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
    };
  }, [user, groupId]);

  // Actions
  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google login error:", error);
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setGroupId(null);
      setCurrentGroup(null);
      setMembers([]);
      setExpenses([]);
    } catch (error: any) {
      console.error("Logout error:", error);
    }
  };

  const handleCreateGroup = async (name: string) => {
    if (!user || !name.trim()) return;
    setIsLoading(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      const groupId = groupRef.id;

      await setDoc(groupRef, {
        name: name.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Create initial host member
      const memberRef = doc(collection(db, 'groups', groupId, 'members'));
      await setDoc(memberRef, {
        name: user.displayName || '主持人',
        userId: user.uid,
        isHost: true,
        createdAt: serverTimestamp()
      });

      // Update user settings
      await setDoc(doc(db, 'users', user.uid), {
        lastGroupId: groupId,
        joinedGroupIds: arrayUnion(groupId)
      }, { merge: true });

      setGroupId(groupId);
    } catch (error) {
      console.error("Create group error:", error);
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (id: string) => {
    if (!user || !id.trim()) return;
    setIsLoading(true);
    const gid = id.trim();
    try {
      const groupRef = doc(db, 'groups', gid);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          lastGroupId: gid,
          joinedGroupIds: arrayUnion(gid)
        }, { merge: true });
        setGroupId(gid);
      } else {
        alert("找不到此群組 ID，請確認後再試。");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Join group error:", error);
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        lastGroupId: null
      }, { merge: true });
      setGroupId(null);
      setCurrentGroup(null);
      setMembers([]);
      setExpenses([]);
    } catch (error) {
      console.error("Leave group error:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!user || !groupId || !currentMemberId) return;
    
    const currentMember = members.find(m => m.id === currentMemberId);
    if (!currentMember?.isHost) return;

    if (window.confirm(`確定要永久刪除群組「${currentGroup?.name}」嗎？\n此操作會刪除所有成員與支出紀錄，且不可復原！`)) {
      setIsLoading(true);
      try {
        // Delete all expenses
        for (const exp of expenses) {
          await deleteDoc(doc(db, 'groups', groupId, 'expenses', exp.id));
        }
        
        // Delete all members
        for (const member of members) {
          await deleteDoc(doc(db, 'groups', groupId, 'members', member.id));
        }

        // Delete group document
        await deleteDoc(doc(db, 'groups', groupId));

        // Update user settings to remove group from history
        await setDoc(doc(db, 'users', user.uid), {
          lastGroupId: null,
          joinedGroupIds: arrayRemove(groupId)
        }, { merge: true });

        // Reset local state
        setGroupId(null);
        setCurrentGroup(null);
        setMembers([]);
        setExpenses([]);
      } catch (error) {
        console.error("Delete group error:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectMember = async (memberId: string | null) => {
    if (!user || !groupId) return;

    if (memberId) {
      const member = members.find(m => m.id === memberId);
      if (member && member.userId && member.userId !== user.uid) {
        alert("此成員已被其他使用者綁定。");
        return;
      }

      // Bind member to user
      const memberRef = doc(db, 'groups', groupId, 'members', memberId);
      await updateDoc(memberRef, {
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    } else {
      // Unbind if we allow it, but here it's more like Logout member
      if (currentMemberId) {
        const memberRef = doc(db, 'groups', groupId, 'members', currentMemberId);
        await updateDoc(memberRef, {
          userId: null,
          updatedAt: serverTimestamp()
        });
      }
    }
  };

  const handleCreateMember = async (name: string) => {
    if (!user || !groupId || !name.trim()) return;

    // 預先產生新成員的 ID
    const membersRef = collection(db, 'groups', groupId, 'members');
    const newDocRef = doc(membersRef);

    try {
      await setDoc(newDocRef, {
        name: name.trim(),
        userId: user.uid, // Auto bind to creator
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Create member error:", err);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!user || !groupId) return;
    try {
      const memberRef = doc(db, 'groups', groupId, 'members', memberId);
      await deleteDoc(memberRef);
    } catch (error) {
      console.error("Delete member error:", error);
    }
  };

  const handleUpdateProfile = async (data: Partial<Member>) => {
    if (!user || !groupId || !currentMemberId) return;

    try {
      const memberRef = doc(db, 'groups', groupId, 'members', currentMemberId);
      await updateDoc(memberRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  const handleUpdateGroupName = async (newName: string) => {
    if (!user || !groupId || !newName.trim()) return;
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        name: newName.trim(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Update group name error:", error);
    }
  };

  const handleDeleteAllExpenses = async () => {
    if (!user || !groupId) return;
    try {
      for (const exp of expenses) {
        await deleteDoc(doc(db, 'groups', groupId, 'expenses', exp.id));
      }
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Delete all expenses error:", error);
    }
  };

  const handleAddExpense = async (expenseData: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!user || !groupId || !currentMemberId) return;

    setIsExpenseModalOpen(false);

    const expensesRef = collection(db, 'groups', groupId, 'expenses');
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
    if (!user || !groupId) return;

    setIsExpenseModalOpen(false);
    setExpenseToEdit(null);

    const expenseRef = doc(db, 'groups', groupId, 'expenses', expenseId);
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
    if (!user || !groupId) return;
    if (window.confirm('確定要刪除這筆支出紀錄嗎？')) {
      const expenseRef = doc(db, 'groups', groupId, 'expenses', expense.id);
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

  // Derived State
  const currentMember = members.find(m => m.id === currentMemberId);
  const filteredExpenses = useMemo(() => {
    if (!filterPaidBy) return expenses;
    return expenses.filter(exp => exp.paidBy === filterPaidBy);
  }, [expenses, filterPaidBy]);

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

  // Routing Logic
  if (!groupId || !currentMemberId || !currentMember) {
    return (
      <OnboardingView 
        members={members} 
        user={user}
        groupId={groupId}
        currentGroup={currentGroup}
        myGroups={myGroups}
        onSelect={handleSelectMember} 
        onCreate={handleCreateMember} 
        onGoogleLogin={handleGoogleLogin}
        onLogout={handleLogout}
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
        onLeaveGroup={handleLeaveGroup}
        onSelectGroup={(id) => setGroupId(id)}
      />
    );
  }

  if (currentView === 'members') {
    return (
      <MemberManagementView 
        members={members} 
        expenses={expenses}
        currentMember={currentMember}
        currentGroup={currentGroup}
        onBack={() => setCurrentView('dashboard')}
        onDeleteMember={handleDeleteMember}
        onDeleteAllExpenses={handleDeleteAllExpenses}
        onUpdateGroupName={handleUpdateGroupName}
        onDeleteGroup={handleDeleteGroup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-indigo-600">
              <Receipt className="w-5 h-5" />
              <h1 className="font-bold text-base leading-tight">{currentGroup?.name || '群組分帳'}</h1>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(groupId);
                alert('已複製群組 ID');
              }}
              className="text-[10px] text-gray-400 flex items-center gap-1 hover:text-indigo-500 transition-colors mt-0.5"
            >
              ID: {groupId.slice(0, 8)}... <Copy className="w-2 h-2" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
              title="個人設定"
            >
              <LucideUser className="w-4 h-4" />
              <span className="max-w-[80px] truncate">{currentMember.name}</span>
            </button>
            <button onClick={handleLeaveGroup}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="切換群組">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BalancesView members={members} expenses={expenses} currentMemberId={currentMemberId} />

        <ExpensesList 
          expenses={filteredExpenses} 
          members={members} 
          onEdit={openEditModal}
          onDelete={handleDeleteExpense} 
          filterPaidBy={filterPaidBy}
          onFilterChange={setFilterPaidBy}
        />
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

      {isProfileModalOpen && currentMember && (
        <ProfileModal
          currentMember={currentMember}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleUpdateProfile}
          onManageMembers={() => {
            setIsProfileModalOpen(false);
            setCurrentView('members');
          }}
        />
      )}
    </div>
  );
}

// --- Components ---
function MemberManagementView({
  members,
  expenses,
  currentMember,
  currentGroup,
  onBack,
  onDeleteMember,
  onDeleteAllExpenses,
  onUpdateGroupName,
  onDeleteGroup
}: {
  members: Member[],
  expenses: Expense[],
  currentMember: Member,
  currentGroup: Group | null,
  onBack: () => void,
  onDeleteMember: (id: string) => void,
  onDeleteAllExpenses: () => void,
  onUpdateGroupName: (name: string) => void,
  onDeleteGroup: () => void
}) {
  const [newName, setNewName] = useState(currentGroup?.name || '');
  const { balances } = useMemo(() => calculateBalancesAndSettlements(members, expenses), [members, expenses]);

  const handleSaveGroupName = () => {
    if (newName.trim() && newName !== currentGroup?.name) {
      onUpdateGroupName(newName);
      alert('群組名稱已更新');
    }
  };

  const handleDeleteMemberByHost = (member: Member) => {
    const balance = balances[member.id] || 0;
    if (Math.abs(balance) > 0.01) {
      alert(`無法刪除成員「${member.name}」，因為該成員還有未結清的款項 (${balance > 0 ? '需收回' : '需支付'} $${Math.abs(balance).toFixed(0)})。`);
      return;
    }
    if (window.confirm(`確定要刪除成員「${member.name}」嗎？此操作不可復原。`)) {
      onDeleteMember(member.id);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('確定要刪除「所有」支出紀錄嗎？此操作不可復原。')) {
      onDeleteAllExpenses();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">成員與管理</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> 成員名單
            </h2>
            <span className="text-xs text-gray-500">{members.length} 位成員</span>
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
                        {m.id === currentMember.id && <span className="text-[10px] text-indigo-500 font-normal">(你自己)</span>}
                        {m.isHost && <Shield className="w-3 h-3 text-amber-500" />}
                      </span>
                      <span className={`text-xs ${Math.abs(balance) < 0.01 ? 'text-green-500' : balance > 0 ? 'text-indigo-500' : 'text-red-500'}`}>
                        {Math.abs(balance) < 0.01 ? '已結清' : `${balance > 0 ? '待收回' : '待支付'} $${Math.abs(balance).toFixed(0)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isClaimedByOthers && <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">已綁定</div>}
                    {m.id !== currentMember.id && currentMember.isHost && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMemberByHost(m)}
                        disabled={!canDelete}
                        className={`p-2 rounded-lg transition-colors ${
                          canDelete 
                            ? 'text-red-500 hover:bg-red-50' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={!canDelete ? "餘額未結清" : "刪除成員"}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" /> 群組資訊
          </h2>
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">群組名稱</span>
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
                    儲存
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium">{currentGroup?.name}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">群組 ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{currentGroup?.id}</code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(currentGroup?.id || '');
                    alert('已複製群組 ID');
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {currentMember.isHost && (
              <div className="pt-4 mt-2 border-t flex items-center justify-between">
                <span className="text-sm text-red-600 font-medium">刪除此群組</span>
                <button 
                  onClick={onDeleteGroup}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除
                </button>
              </div>
            )}
          </div>
        </section>

        {currentMember.isHost && (
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" /> 危險區域
            </h2>
            <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">刪除所有支出紀錄</h3>
                <p className="text-xs text-gray-500 mt-1">此操作將永久清除群組內的所有帳務資料，不可復原。</p>
              </div>
              <button type="button" onClick={handleDeleteAll}
                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
                立即刪除所有紀錄
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function OnboardingView({ members, user, groupId, currentGroup, myGroups, onSelect, onCreate, onGoogleLogin, onLogout, onCreateGroup, onJoinGroup, onLeaveGroup, onSelectGroup }: { 
  members: Member[], 
  user: User | null,
  groupId: string | null,
  currentGroup: Group | null,
  myGroups: Group[],
  onSelect: (id: string) => void, 
  onCreate: (name: string) => void,
  onGoogleLogin: () => void,
  onLogout: () => void,
  onCreateGroup: (name: string) => void,
  onJoinGroup: (id: string) => void,
  onLeaveGroup: () => void,
  onSelectGroup: (id: string) => void
}) {
  const [newName, setNewName] = useState('');

  if (!groupId) {
    return (
      <GroupSelectionView 
        user={user} 
        myGroups={myGroups}
        onGoogleLogin={onGoogleLogin} 
        onLogout={onLogout} 
        onCreateGroup={onCreateGroup} 
        onJoinGroup={onJoinGroup} 
        onSelectGroup={onSelectGroup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={onLeaveGroup} className="text-gray-400 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{currentGroup?.name}</h1>
          <p className="text-gray-500 text-sm">請選擇你的身分，或建立新成員</p>
        </div>

        <div className="space-y-6">
          {members.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
                  <span className="px-2 bg-white text-gray-400">選擇既有成員</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const isClaimedByOthers = m.userId && m.userId !== user?.uid;
                  const isMe = m.userId === user?.uid;
                  
                  return (
                    <button 
                      key={m.id} 
                      onClick={() => !isClaimedByOthers && onSelect(m.id)}
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
                        {isMe ? '這就是你' : isClaimedByOthers ? '已被綁定' : '尚未綁定'}
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
              <span className="px-2 bg-white text-gray-400">或</span>
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
                focus:border-transparent outline-none text-sm"
                required
              />
              <button type="submit" disabled={!newName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors text-sm">
                進入
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function GroupSelectionView({ user, myGroups, onGoogleLogin, onLogout, onCreateGroup, onJoinGroup, onSelectGroup }: {
  user: User | null,
  myGroups: Group[],
  onGoogleLogin: () => void,
  onLogout: () => void,
  onCreateGroup: (name: string) => void,
  onJoinGroup: (id: string) => void,
  onSelectGroup: (id: string) => void
}) {
  const [groupName, setGroupName] = useState('');
  const [groupIdToJoin, setGroupIdToJoin] = useState('');
  const isAnonymous = user?.isAnonymous;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">群組分帳</h1>
          <p className="text-gray-500 text-sm">建立新群組，或加入既有群組</p>
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
                  {isAnonymous ? '匿名使用者' : (user?.displayName || user?.email || '已登入')}
                </span>
                {isAnonymous && <button onClick={onGoogleLogin} className="text-[10px] text-indigo-600 text-left hover:underline">使用 Google 登入以永久保存</button>}
              </div>
            </div>
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {myGroups.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" /> 最近使用的群組
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
                <span className="px-2 bg-white text-gray-400">或是</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700">建立新群組</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={groupName} 
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="輸入群組名稱"
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                />
                <button 
                  onClick={() => onCreateGroup(groupName)}
                  disabled={!groupName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors text-sm whitespace-nowrap"
                >
                  建立
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-bold text-gray-700">加入既有群組</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={groupIdToJoin} 
                  onChange={(e) => setGroupIdToJoin(e.target.value)}
                  placeholder="輸入群組 ID"
                  className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-mono"
                />
                <button 
                  onClick={() => onJoinGroup(groupIdToJoin)}
                  disabled={!groupIdToJoin.trim()}
                  className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-50 transition-colors text-sm whitespace-nowrap"
                >
                  加入
                </button>
              </div>
            </div>
          </div>
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

function ExpensesList({ expenses, members, onEdit, onDelete, filterPaidBy, onFilterChange }: { 
  expenses: Expense[], 
  members: Member[], 
  onEdit: (exp: Expense) => void,
  onDelete: (exp: Expense) => void,
  filterPaidBy: string | null,
  onFilterChange: (id: string | null) => void
}) {
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

function ProfileModal({ 
  currentMember, 
  onClose, 
  onSave, 
  onManageMembers
}: { 
  currentMember: Member, 
  onClose: () => void, 
  onSave: (data: Partial<Member>) => void,
  onManageMembers: () => void
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
