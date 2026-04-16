import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
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
  handleAddExpense: (expenseData: ExpenseInput) => Promise<void>;
  handleUpdateExpense: (expenseId: string, expenseData: Partial<ExpenseInput>) => Promise<void>;
  handleDeleteExpense: (expense: Expense) => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useDialog();
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
        // Doc doesn't exist (deleted), just navigate away. 
        // The sync effect will handle clearing groupId.
        navigate('/', { replace: true });
      }
    }, (error) => {
      console.error("Group fetch error:", error);
      navigate('/', { replace: true });
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
        name: user.displayName || (i18n.language.startsWith('zh') ? '主持人' : 'Host'), userId: user.uid, isHost: true, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'users', user.uid), { lastGroupId: gid, joinedGroupIds: arrayUnion(gid) }, { merge: true });
      navigate(`/group/${gid}`);
    } catch (error) { 
      console.error("Create group error:", error); 
      toast.error(t('common.error'));
      setIsLoading(false); 
    }
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
        toast.error(t('common.error_group_not_found')); 
        setIsLoading(false); 
      }
    } catch (error) { 
      console.error("Join group error:", error); 
      toast.error(t('common.error'));
      setIsLoading(false); 
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { lastGroupId: null }, { merge: true });
      navigate('/');
    } catch (error) { console.error("Leave group error:", error); }
  };

  const handleDeleteGroup = async () => {
    if (!user || !groupId || !currentMemberId) return;
    const currentMember = members.find(m => m.id === currentMemberId);
    if (!currentMember?.isHost) return;
    
    const isConfirmed = await confirm(t('groups.delete_group_msg', { name: currentGroup?.name }), {
      title: t('groups.delete_group'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel')
    });

    if (isConfirmed) {
      setIsLoading(true);
      try {
        const gid = groupId;
        // Batch operations would be better, but keeping the current sequential approach for now
        for (const exp of expenses) await deleteDoc(doc(db, 'groups', gid, 'expenses', exp.id));
        for (const m of members) await deleteDoc(doc(db, 'groups', gid, 'members', m.id));
        await deleteDoc(doc(db, 'groups', gid));
        await setDoc(doc(db, 'users', user.uid), { lastGroupId: null, joinedGroupIds: arrayRemove(gid) }, { merge: true });
        
        navigate('/', { replace: true });
      } catch (error) { 
        console.error("Delete group error:", error); 
        toast.error(t('common.error'));
      } finally { 
        setIsLoading(false); 
      }
    }
  };

  const handleSelectMember = async (memberId: string) => {
    if (!user || !groupId) return;
    const member = members.find(m => m.id === memberId);
    if (member && member.userId && member.userId !== user.uid) { 
      toast.error(t('members.claimed')); 
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
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    // By host, we don't bind a userId so anyone can claim it later
    await addDoc(collection(db, 'groups', groupId, 'members'), { 
      name: name.trim(), 
      userId: null, 
      createdAt: serverTimestamp() 
    });
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!user || !groupId) return;
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
  };

  const handleUpdateProfile = async (data: Partial<Member>) => {
    if (!user || !groupId || !currentMemberId) return;
    await updateDoc(doc(db, 'groups', groupId, 'members', currentMemberId), { ...data, updatedAt: serverTimestamp() });
    toast.success(t('profile.settings_updated'));
  };

  const handleUpdateGroupName = async (newName: string) => {
    if (!user || !groupId || !newName.trim()) return;
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    await updateDoc(doc(db, 'groups', groupId), { name: newName.trim(), updatedAt: serverTimestamp() });
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
    const isConfirmed = await confirm(t('expenses.delete_msg'));
    if (isConfirmed) {
      await deleteDoc(doc(db, 'groups', groupId, 'expenses', expense.id));
      toast.success(t('expenses.deleted'));
    }
  };

  const currentMember = members.find(m => m.id === currentMemberId);

  const value = {
    groupId, currentGroup, myGroups, members, expenses, currentMemberId, currentMember,
    isLoading, 
    handleCreateGroup, handleJoinGroup, handleLeaveGroup, handleDeleteGroup,
    handleSelectMember, handleCreateMember, handleCreateMemberByHost, handleDeleteMember, handleUpdateProfile,
    handleUpdateGroupName, handleAddExpense, handleUpdateExpense, handleDeleteExpense
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
