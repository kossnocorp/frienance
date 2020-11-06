import { collection } from "typesaurus";

export const ledgers = collection<Ledger>("ledgers");

export type Ledger = {
  telegramChatId: number;
  members: Record<string, Member>;
  joints: Record<string, Joint>;
  history: LedgerAction[];
};

export type Member = {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  since: Date;
};

export type Joint = {
  memberIds: string[];
};

export type LedgerAction =
  | LedgerRegisterAction
  | LedgerExpenseAction
  | LedgerJoinAction
  | LedgerSeparateAction;

export type LedgerActionType = LedgerAction["type"];

export type LedgerRegisterAction = {
  type: "register";
  memberId: string;
  member: Member;
  createdAt: Date;
};

export type LedgerExpenseAction = {
  type: "expense";
  memberId: string;
  value: number;
  currency: string;
  valueUSD: number;
  exchangeRate: ExchangeRate;
  createdAt: Date;
  comment?: string;
};

export type LedgerJoinAction = {
  type: "join";
  memberId: string;
  joiningMemberId: string;
  createdAt: Date;
};

export type LedgerSeparateAction = {
  type: "separate";
  memberId: string;
  separatingMemberId: string;
  createdAt: Date;
};

export type ExchangeRate = {
  base: string;
  rate: number;
  date: Date;
};
