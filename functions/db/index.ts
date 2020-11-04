import { collection } from "typesaurus";

export const ledgers = collection<Ledger>("ledgers");

export type Ledger = {
  telegramChatId: number;
  members: Record<string, Member>;
  history: LedgerAction[];
};

export type Member = {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  since: Date;
};

export type LedgerAction = LedgerRegisterAction | LedgerExpense;

export type LedgerActionType = LedgerAction["type"];

export type LedgerRegisterAction = {
  type: "register";
  memberId: string;
  member: Member;
  createdAt: Date;
};

export type LedgerExpense = {
  type: "expense";
  memberId: string;
  value: number;
  currency: string;
  valueUSD: number;
  exchangeRate: ExchangeRate;
  createdAt: Date;
  comment?: string;
};

export type ExchangeRate = {
  base: string;
  rate: number;
  date: Date;
};
