import { InterfaceUnion } from "typeroo";
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

export type LedgerAction = InterfaceUnion<
  LedgerRegisterAction,
  LedgerExpenseAction,
  LedgerJoinAction,
  LedgerBorrowAction,
  LedgerGiveAction,
  LedgerReliefAction,
  LedgerSeparateAction
>;

export type LedgerActionType = LedgerAction["type"];

export interface LedgerActionBase<Type extends string> {
  type: Type;
  memberId: string;
  createdAt: Date;
  comment?: string;
}

export interface LedgerActionValuedBase {
  value: number;
  currency: string;
  valueUSD: number;
  exchangeRate: ExchangeRate;
}

export interface LedgerRegisterAction extends LedgerActionBase<"register"> {
  member: Member;
}

export interface LedgerExpenseAction
  extends LedgerActionBase<"expense">,
    LedgerActionValuedBase {}

export interface LedgerGiveAction
  extends LedgerActionBase<"give">,
    LedgerActionValuedBase {
  givingToMemberId: string;
}

export interface LedgerReliefAction extends LedgerActionBase<"relief"> {
  relievingMemberId: string;
}

export interface LedgerBorrowAction
  extends LedgerActionBase<"borrow">,
    LedgerActionValuedBase {
  borrowingFromMemberId: string;
}

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

export interface ExchangeRate {
  base: string;
  rate: number;
  date: Date;
}
