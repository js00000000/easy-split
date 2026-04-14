import { Timestamp } from 'firebase/firestore';

export interface Member {
  id: string;
  name: string;
  userId?: string; // Binds to a Firebase User UID
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  bankCode?: string;
  bankAccount?: string;
  isHost?: boolean;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserSettings {
  lastGroupId: string | null;
  joinedGroupIds?: string[];
  currentMemberId?: string | null;
}
