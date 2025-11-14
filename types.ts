// Fix: Import React to make the JSX namespace available.
import React from 'react';
import { Timestamp } from 'firebase/firestore';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string; // Storing the key of the icon, not the element
  type: 'income' | 'expense';
}

export interface FamilyMember {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  date: string; // ISO 8601 format: YYYY-MM-DD
  description: string;
  memberId?: string; // Optional: Link to a family member
}

export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface UserProfile {
  id: string; // This will be the user's UID
  email: string;
  status: UserStatus;
  accessExpiresAt: number | null; // JS timestamp or null for lifetime
  createdAt: Timestamp;
}
