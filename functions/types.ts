export type Ledger = {
  telegramChatId: number;
  users: Record<string, User>;
  history: LedgerAction[];
};

export type User = {
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
  userId: string;
  user: User;
  createdAt: Date;
};

export type LedgerExpense = {
  type: "expense";
  userId: string;
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
