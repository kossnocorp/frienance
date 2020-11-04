import { calculateHistoryBalance, calculateLedgerState } from ".";
import { LedgerExpenseAction, LedgerRegisterAction } from "../../db";

describe("Calculate balance command", () => {
  describe("calculateHistoryBalance", () => {
    it("calculates simple ledges", () => {
      const result = calculateHistoryBalance([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("sasha", 10),
      ]);
      expect(result.balance).toEqual([
        {
          who: ["sasha"],
          whom: ["nadi"],
          value: 45,
        },
      ]);
    });

    it("allows to sum dept", () => {
      const result = calculateHistoryBalance([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("nadi", 100),
      ]);
      expect(result.balance).toEqual([
        {
          who: ["sasha"],
          whom: ["nadi"],
          value: 100,
        },
      ]);
    });

    it("allows to repay dept", () => {
      const result = calculateHistoryBalance([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("nadi", 100),
        expense("sasha", 200),
      ]);
      expect(result.balance).toEqual([]);
    });

    it("allows to update dept", () => {
      const result = calculateHistoryBalance([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("nadi", 100),
        expense("sasha", 300),
      ]);
      expect(result.balance).toEqual([
        {
          who: ["nadi"],
          whom: ["sasha"],
          value: 50,
        },
      ]);
    });
  });

  describe("calculateLedgerState", () => {
    it("calculates simple ledge state", () => {
      const result = calculateLedgerState([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("sasha", 10),
      ]);
      expect(result).toEqual({
        members: { sasha, nadi },
        joints: [],
        splits: [
          { who: ["sasha"], whom: ["nadi"], value: 50 },
          { who: ["nadi"], whom: ["sasha"], value: 5 },
        ],
      });
    });
  });
});

var sasha = {
  telegramId: 123,
  firstName: "Sasha",
  lastName: "Koss",
  username: "kossnocorp",
  since: new Date(),
};

var registerSasha: LedgerRegisterAction = {
  type: "register",
  memberId: "sasha",
  member: sasha,
  createdAt: new Date(),
};

var nadi = {
  telegramId: 456,
  firstName: "Nadi",
  since: new Date(),
};

var registerNadi: LedgerRegisterAction = {
  type: "register",
  memberId: "nadi",
  member: nadi,
  createdAt: new Date(),
};

function expense(memberId: string, value: number): LedgerExpenseAction {
  return {
    type: "expense",
    memberId,
    value,
    currency: "USD",
    valueUSD: value,
    exchangeRate: {
      base: "USD",
      rate: 1,
      date: new Date(),
    },
    createdAt: new Date(),
  };
}
