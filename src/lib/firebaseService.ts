import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Member, Expense } from '../types';

export type ExpenseInput = Omit<Expense, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

export const firebaseService = {
  async createGroup(userId: string, groupName: string, hostName: string) {
    const groupRef = doc(collection(db, 'groups'));
    const groupId = groupRef.id;

    const batch = writeBatch(db);

    // 1. Create Group
    batch.set(groupRef, {
      name: groupName.trim(),
      createdBy: userId,
      createdAt: serverTimestamp(),
    });

    // 2. Create Host Member
    const memberRef = doc(collection(db, 'groups', groupId, 'members'));
    batch.set(memberRef, {
      name: hostName,
      userId: userId,
      isHost: true,
      createdAt: serverTimestamp(),
    });

    // 3. Update User Settings
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, {
      lastGroupId: groupId,
      joinedGroupIds: arrayUnion(groupId),
    }, { merge: true });

    await batch.commit();
    return groupId;
  },

  async joinGroup(userId: string, groupId: string) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      throw new Error('group_not_found');
    }

    await setDoc(doc(db, 'users', userId), {
      lastGroupId: groupId,
      joinedGroupIds: arrayUnion(groupId),
    }, { merge: true });
  },

  async deleteGroup(userId: string, groupId: string, expenseIds: string[], memberIds: string[]) {
    const batch = writeBatch(db);

    // 1. Delete all expenses
    for (const id of expenseIds) {
      batch.delete(doc(db, 'groups', groupId, 'expenses', id));
    }

    // 2. Delete all members
    for (const id of memberIds) {
      batch.delete(doc(db, 'groups', groupId, 'members', id));
    }

    // 3. Delete group itself
    batch.delete(doc(db, 'groups', groupId));

    // 4. Update user settings (remove from joined lists)
    batch.set(doc(db, 'users', userId), {
      lastGroupId: null,
      joinedGroupIds: arrayRemove(groupId),
    }, { merge: true });

    await batch.commit();
  },

  async claimMember(groupId: string, memberId: string, userId: string) {
    await updateDoc(doc(db, 'groups', groupId, 'members', memberId), {
      userId,
      updatedAt: serverTimestamp(),
    });
  },

  async createMember(groupId: string, name: string, userId: string | null = null) {
    return await addDoc(collection(db, 'groups', groupId, 'members'), {
      name: name.trim(),
      userId,
      createdAt: serverTimestamp(),
    });
  },

  async deleteMember(groupId: string, memberId: string) {
    await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
  },

  async updateMember(groupId: string, memberId: string, data: Partial<Member>) {
    await updateDoc(doc(db, 'groups', groupId, 'members', memberId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async updateGroupName(groupId: string, newName: string) {
    await updateDoc(doc(db, 'groups', groupId), {
      name: newName.trim(),
      updatedAt: serverTimestamp(),
    });
  },

  async addExpense(groupId: string, memberId: string, expenseData: ExpenseInput) {
    return await addDoc(collection(db, 'groups', groupId, 'expenses'), {
      ...expenseData,
      createdBy: memberId,
      createdAt: serverTimestamp(),
    });
  },

  async updateExpense(groupId: string, expenseId: string, expenseData: Partial<ExpenseInput>) {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), {
      ...expenseData,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteExpense(groupId: string, expenseId: string) {
    await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
  },

  async updateUserLastGroup(userId: string, groupId: string | null) {
    await setDoc(doc(db, 'users', userId), {
      lastGroupId: groupId,
    }, { merge: true });
  }
};
