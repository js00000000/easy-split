import { useState, useEffect, useMemo } from 'react';
import {
  User as LucideUser, Plus, Receipt, LogOut, X, Copy
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
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
  arrayUnion,
  arrayRemove,
  query,
  where,
  documentId
} from 'firebase/firestore';
import { db, auth, googleProvider } from './lib/firebase';
import type { Member, Group, Expense, UserSettings } from './types';
import { ExpenseModal } from './components/ExpenseModal';
import { ProfileModal } from './components/ProfileModal';
import { ExpensesList } from './components/ExpensesList';
import { BalancesView } from './components/BalancesView';
import { OnboardingView } from './components/OnboardingView';
import { MemberManagementView } from './components/MemberManagementView';
import { AuthErrorView } from './components/AuthErrorView';
import { LoadingView } from './components/LoadingView';

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
    return <AuthErrorView error={authError} />;
  }

  if (authLoading || isLoading) {
    return <LoadingView />;
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