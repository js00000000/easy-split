import { describe, it, expect } from 'vitest';
import { calculateBalancesAndSettlements } from './settlement';
import type { Member, Expense } from './settlement';

describe('Settlement Logic', () => {
  it('should calculate correct balances for simple two-person split', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Lunch',
        amount: 100,
        paidBy: '1', // Alice paid 100
        splitAmong: ['1', '2'], // Split between Alice and Bob
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    // Alice: +100 (paid) - 50 (share) = +50
    // Bob: - 50 (share) = -50
    expect(balances['1']).toBe(50);
    expect(balances['2']).toBe(-50);

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: '2', to: '1', amount: 50 });
  });

  it('should handle multiple expenses and complex splits', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Dinner',
        amount: 300,
        paidBy: '1', // Alice paid 300
        splitAmong: ['1', '2', '3'], // 100 each
      },
      {
        id: 'e2',
        description: 'Drinks',
        amount: 60,
        paidBy: '2', // Bob paid 60
        splitAmong: ['2', '3'], // 30 each
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    // Alice: +300 (paid e1) - 100 (share e1) = +200
    // Bob: +60 (paid e2) - 100 (share e1) - 30 (share e2) = -70
    // Charlie: -100 (share e1) - 30 (share e2) = -130
    expect(balances['1']).toBe(200);
    expect(balances['2']).toBe(-70);
    expect(balances['3']).toBe(-130);

    // Settlements:
    // Charlie pays 130 to Alice
    // Bob pays 70 to Alice
    expect(settlements).toContainEqual({ from: '3', to: '1', amount: 130 });
    expect(settlements).toContainEqual({ from: '2', to: '1', amount: 70 });
  });

  it('should handle zero balances correctly', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Lunch',
        amount: 100,
        paidBy: '1',
        splitAmong: ['1', '2'],
      },
      {
        id: 'e2',
        description: 'Dinner',
        amount: 100,
        paidBy: '2',
        splitAmong: ['1', '2'],
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    expect(balances['1']).toBe(0);
    expect(balances['2']).toBe(0);
    expect(settlements).toHaveLength(0);
  });

  it('should handle floating point numbers safely', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Shared bill',
        amount: 100,
        paidBy: '1',
        splitAmong: ['1', '2', '3'], // 33.333... each
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    // Alice: 100 - 33.333... = 66.666...
    // Bob: -33.333...
    // Charlie: -33.333...
    expect(balances['1']).toBeCloseTo(66.67, 1);
    expect(balances['2']).toBeCloseTo(-33.33, 1);
    expect(balances['3']).toBeCloseTo(-33.33, 1);

    expect(settlements.reduce((sum, s) => sum + s.amount, 0)).toBeCloseTo(66.67, 1);
  });

  it('should handle cases where the payer is not in the splitAmong list', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Alice treats Bob and Charlie',
        amount: 100,
        paidBy: '1',
        splitAmong: ['2', '3'], // Alice is NOT in this list
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    // Alice: +100
    // Bob: -50
    // Charlie: -50
    expect(balances['1']).toBe(100);
    expect(balances['2']).toBe(-50);
    expect(balances['3']).toBe(-50);
    expect(settlements).toHaveLength(2);
  });

  it('should not crash or produce settlements for expenses with no splitters', () => {
    const members: Member[] = [
      { id: '1', name: 'Alice' },
    ];
    const expenses: Expense[] = [
      {
        id: 'e1',
        description: 'Empty split',
        amount: 100,
        paidBy: '1',
        splitAmong: [],
      },
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    expect(balances['1']).toBe(100); // She paid, but nobody owes her anything because nobody was in the split
    expect(settlements).toHaveLength(0);
  });

  it('should handle complex debt cycles and minimize transactions', () => {
    // This test ensures the greedy algorithm correctly settles multiple overlapping debts
    const members: Member[] = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
      { id: '4', name: 'D' },
    ];
    const expenses: Expense[] = [
      { id: 'e1', description: 'B owes A', amount: 100, paidBy: '1', splitAmong: ['2'] }, // B owes A 100
      { id: 'e2', description: 'C owes B', amount: 100, paidBy: '2', splitAmong: ['3'] }, // C owes B 100
      { id: 'e3', description: 'D owes C', amount: 100, paidBy: '3', splitAmong: ['4'] }, // D owes C 100
    ];

    const { balances, settlements } = calculateBalancesAndSettlements(members, expenses);

    // A: +100
    // B: -100 + 100 = 0
    // C: -100 + 100 = 0
    // D: -100
    expect(balances['1']).toBe(100);
    expect(balances['2']).toBe(0);
    expect(balances['3']).toBe(0);
    expect(balances['4']).toBe(-100);

    // Should result in only ONE transaction: D pays A 100
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: '4', to: '1', amount: 100 });
  });
});
