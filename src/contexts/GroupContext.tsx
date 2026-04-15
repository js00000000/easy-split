import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { db } from '../lib/firebase';
import type { Member, Group, Expense, UserSettings } from '../types';
import { useAuth } from './AuthContext';
import { useDialog } from './DialogContext';

type ExpenseInput = Omit<Expense, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

interface GroupContextType {
  groupId: string | null;
  currentGroup: Group | null;
  myGroups: Group[];
  members: Member[];
  expenses: Expense[];
  currentMemberId: string | null;
  currentMember: Member | undefined;
  isLoading: boolean;
  handleCreateGroup: (name: string) => Promise<void>;
  handleJoinGroup: (id: string) => Promise<void>;
  handleLeaveGroup: () => Promise<void>;
  handleDeleteGroup: () => Promise<void>;
  handleSelectMember: (memberId: string) => Promise<void>;
  handleCreateMember: (name: string) => Promise<void>;
  handleCreateMemberByHost: (name: string) => Promise<void>;
  handleDeleteMember: (memberId: string) => Promise<void>;
  handleUpdateProfile: (data: Partial<Member>) => Promise<void>;
  handleUpdateGroupName: (newName: string) => Promise<void>;
  handleDeleteAllExpenses: () => Promise<void>;
  handleAddExpense: (expenseData: ExpenseInput) => Promise<void>;
  handleUpdateExpense: (expenseId: string, expenseData: Partial<ExpenseInput>) => Promise<void>;
  handleDeleteExpense: (expense: Expense) => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { alert, confirm } = useDialog();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state with URL
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const idFromUrl = (pathParts[1] === 'group' && pathParts[2]) ? pathParts[2] : null;
    
    if (idFromUrl !== groupId) {
      setGroupId(idFromUrl);
    }
  }, [location.pathname, groupId]);

  // User Settings Hook
  useEffect(() => {
    if (!user) return;

    const settingsRef = doc(db, 'users', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        if (data.joinedGroupIds && data.joinedGroupIds.length > 0) {
          const groupsQuery = query(
            collection(db, 'groups'),
            where(documentId(), 'in', data.joinedGroupIds.slice(0, 30))
          );
          getDocs(groupsQuery).then(snapshot => {
            const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
            setMyGroups(groupsData);
          }).catch(err => console.error("Fetch my groups error:", err));
        } else {
          setMyGroups([]);
        }
      } else {
        setMyGroups([]);
      }
    });

    return () => unsubSettings();
  }, [user]);

  // Group Data Hook
  useEffect(() => {
    if (!user || !groupId) {
      if (user && !groupId) setIsLoading(false);
      setMembers([]);
      setExpenses([]);
      setCurrentGroup(null);
      setCurrentMemberId(null);
      return;
    }

    setIsLoading(true);
    const groupRef = doc(db, 'groups', groupId);
    const unsubGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentGroup({ id: docSnap.id, ...docSnap.data() } as Group);
      } else {
        setGroupId(null);
        navigate('/');
      }
    });

    const membersRef = collection(db, 'groups', groupId, 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      membersData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMembers(membersData);

      const myMember = membersData.find(m => m.userId === user.uid);
      if (myMember) setCurrentMemberId(myMember.id);
      else setCurrentMemberId(null);
      setIsLoading(false);
    }, (error) => {
      console.error("Members fetch error:", error);
      setIsLoading(false);
    });

    const expensesRef = collection(db, 'groups', groupId, 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      expensesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setExpenses(expensesData);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
    };
  }, [user, groupId, navigate]);

  const handleCreateGroup = async (name: string) => {
    if (!user || !name.trim()) return;
    setIsLoading(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      const gid = groupRef.id;
      await setDoc(groupRef, { name: name.trim(), createdBy: user.uid, createdAt: serverTimestamp() });
      await setDoc(doc(db, 'groups', gid, 'members', doc(collection(db, 'groups', gid, 'members')).id), {
        name: user.displayName || '主持人', userId: user.uid, isHost: true, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'users', user.uid), { lastGroupId: gid, joinedGroupIds: arrayUnion(gid) }, { merge: true });
      navigate(`/group/${gid}`);
    } catch (error) { console.error("Create group error:", error); setIsLoading(false); }
  };

  const handleJoinGroup = async (id: string) => {
    if (!user || !id.trim()) return;
    setIsLoading(true);
    const gid = id.trim();
    try {
      if ((await getDoc(doc(db, 'groups', gid))).exists()) {
        await setDoc(doc(db, 'users', user.uid), { lastGroupId: gid, joinedGroupIds: arrayUnion(gid) }, { merge: true });
        navigate(`/group/${gid}`);
      } else { 
        await alert("找不到此群組 ID，請確認後再試。"); 
        setIsLoading(false); 
      }
    } catch (error) { console.error("Join group error:", error); setIsLoading(false); }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { lastGroupId: null }, { merge: true });
      setGroupId(null); setCurrentGroup(null); setMembers([]); setExpenses([]);
      navigate('/');
    } catch (error) { console.error("Leave group error:", error); }
  };

  const handleDeleteGroup = async () => {
    if (!user || !groupId || !currentMemberId) return;
    const currentMember = members.find(m => m.id === currentMemberId);
    if (!currentMember?.isHost) return;
    
    const isConfirmed = await confirm(`確定要永久刪除群組「${currentGroup?.name}」嗎？`, {
      title: '刪除群組',
      confirmLabel: '確定刪除',
      cancelLabel: '取消'
    });

    if (isConfirmed) {
      setIsLoading(true);
      try {
        for (const exp of expenses) await deleteDoc(doc(db, 'groups', groupId, 'expenses', exp.id));
        for (const m of members) await deleteDoc(doc(db, 'groups', groupId, 'members', m.id));
        await deleteDoc(doc(db, 'groups', groupId));
        await setDoc(doc(db, 'users', user.uid), { lastGroupId: null, joinedGroupIds: arrayRemove(groupId) }, { merge: true });
        navigate('/');
      } catch (error) { console.error("Delete group error:", error); } finally { setIsLoading(false); }
    }
  };

  const handleSelectMember = async (memberId: string) => {
    if (!user || !groupId) return;
    const member = members.find(m => m.id === memberId);
    if (member && member.userId && member.userId !== user.uid) { 
      await alert("此成員已被其他使用者綁定。"); 
      return; 
    }
    await updateDoc(doc(db, 'groups', groupId, 'members', memberId), { userId: user.uid, updatedAt: serverTimestamp() });
  };

  const handleCreateMember = async (name: string) => {
    if (!user || !groupId || !name.trim()) return;
    await addDoc(collection(db, 'groups', groupId, 'members'), { name: name.trim(), userId: user.uid, createdAt: serverTimestamp() });
  };

  const handleCreateMemberByHost = async (name: string) => {
    if (!user || !groupId || !name.trim()) return;
    // By host, we don't bind a userId so anyone can claim it later
    await addDoc(collection(db, 'groups', groupId, 'members'), { 
      name: name.trim(), 
      userId: null, 
      createdAt: serverTimestamp() 
    });
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!user || !groupId) return;
    await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
  };

  const handleUpdateProfile = async (data: Partial<Member>) => {
    if (!user || !groupId || !currentMemberId) return;
    await updateDoc(doc(db, 'groups', groupId, 'members', currentMemberId), { ...data, updatedAt: serverTimestamp() });
  };

  const handleUpdateGroupName = async (newName: string) => {
    if (!user || !groupId || !newName.trim()) return;
    await updateDoc(doc(db, 'groups', groupId), { name: newName.trim(), updatedAt: serverTimestamp() });
  };

  const handleDeleteAllExpenses = async () => {
    if (!user || !groupId) return;
    for (const exp of expenses) await deleteDoc(doc(db, 'groups', groupId, 'expenses', exp.id));
  };

  const handleAddExpense = async (expenseData: ExpenseInput) => {
    if (!user || !groupId || !currentMemberId) return;
    await addDoc(collection(db, 'groups', groupId, 'expenses'), { ...expenseData, createdBy: currentMemberId, createdAt: serverTimestamp() });
  };

  const handleUpdateExpense = async (expenseId: string, expenseData: Partial<ExpenseInput>) => {
    if (!user || !groupId) return;
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), { ...expenseData, updatedAt: serverTimestamp() });
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!user || !groupId) return;
    const isConfirmed = await confirm('確定要刪除這筆支出紀錄嗎？');
    if (isConfirmed) await deleteDoc(doc(db, 'groups', groupId, 'expenses', expense.id));
  };

  const currentMember = members.find(m => m.id === currentMemberId);

  const value = {
    groupId, currentGroup, myGroups, members, expenses, currentMemberId, currentMember,
    isLoading, 
    handleCreateGroup, handleJoinGroup, handleLeaveGroup, handleDeleteGroup,
    handleSelectMember, handleCreateMember, handleCreateMemberByHost, handleDeleteMember, handleUpdateProfile,
    handleUpdateGroupName, handleDeleteAllExpenses, handleAddExpense, handleUpdateExpense, handleDeleteExpense
  };

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}
