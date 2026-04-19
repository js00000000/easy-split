import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  documentId
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { firebaseService, type ExpenseInput } from '../lib/firebaseService';
import type { Member, Group, Expense, UserSettings } from '../types';
import { useAuth } from './AuthContext';
import { useDialog } from './DialogContext';

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
          // Keeping getDocs here for settings as it's a one-time fetch or rarely changes
          import('firebase/firestore').then(({ getDocs }) => {
            getDocs(groupsQuery).then(snapshot => {
              const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
              setMyGroups(groupsData);
            }).catch(err => console.error("Fetch my groups error:", err));
          });
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
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentGroup({ id: docSnap.id, ...docSnap.data() } as Group);
      } else {
        navigate('/', { replace: true });
      }
    }, (error) => {
      console.error("Group fetch error:", error);
      navigate('/', { replace: true });
    });

    const unsubMembers = onSnapshot(collection(db, 'groups', groupId, 'members'), (snapshot) => {
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

    const unsubExpenses = onSnapshot(collection(db, 'groups', groupId, 'expenses'), (snapshot) => {
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
      const hostName = user.displayName || (i18n.language.startsWith('zh') ? '主持人' : 'Host');
      const gid = await firebaseService.createGroup(user.uid, name, hostName);
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
    try {
      await firebaseService.joinGroup(user.uid, id);
      navigate(`/group/${id.trim()}`);
    } catch (error) { 
      console.error("Join group error:", error); 
      const msg = (error as Error).message === 'group_not_found' ? t('common.error_group_not_found') : t('common.error');
      toast.error(msg);
      setIsLoading(false); 
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      await firebaseService.updateUserLastGroup(user.uid, null);
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
        await firebaseService.deleteGroup(
          user.uid, 
          groupId, 
          expenses.map(e => e.id), 
          members.map(m => m.id)
        );
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
    await firebaseService.claimMember(groupId, memberId, user.uid);
  };

  const handleCreateMember = async (name: string) => {
    if (!user || !groupId || !name.trim()) return;
    await firebaseService.createMember(groupId, name, user.uid);
  };

  const handleCreateMemberByHost = async (name: string) => {
    if (!user || !groupId || !name.trim()) return;
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    await firebaseService.createMember(groupId, name, null);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!user || !groupId) return;
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    await firebaseService.deleteMember(groupId, memberId);
  };

  const handleUpdateProfile = async (data: Partial<Member>) => {
    if (!user || !groupId || !currentMemberId) return;
    await firebaseService.updateMember(groupId, currentMemberId, data);
    toast.success(t('profile.settings_updated'));
  };

  const handleUpdateGroupName = async (newName: string) => {
    if (!user || !groupId || !newName.trim()) return;
    const currentMember = members.find(m => m.userId === user.uid);
    if (!currentMember?.isHost) {
      toast.error(t('common.error_host_only'));
      return;
    }
    await firebaseService.updateGroupName(groupId, newName);
  };

  const handleAddExpense = async (expenseData: ExpenseInput) => {
    if (!user || !groupId || !currentMemberId) return;
    await firebaseService.addExpense(groupId, currentMemberId, expenseData);
  };

  const handleUpdateExpense = async (expenseId: string, expenseData: Partial<ExpenseInput>) => {
    if (!user || !groupId) return;
    await firebaseService.updateExpense(groupId, expenseId, expenseData);
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!user || !groupId) return;
    const isConfirmed = await confirm(t('expenses.delete_msg'));
    if (isConfirmed) {
      await firebaseService.deleteExpense(groupId, expense.id);
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

