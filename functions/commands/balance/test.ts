import {
  biggestJoint,
  calculateHistoryBalance,
  calculateLedgerState,
  splitOutdatedJoints,
} from ".";
import {
  LedgerExpenseAction,
  LedgerJoinAction,
  LedgerRegisterAction,
  LedgerSeparateAction,
} from "../../db";

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

    describe("joints", () => {
      it("allows to join finances", () => {
        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            expense("nadi", 100),
            expense("nadi", 100),
            expense("sasha", 300),
            registerTati,
            join("sasha", "tati"),
          ]).balance
        ).toEqual([
          {
            who: ["nadi"],
            whom: ["sasha", "tati"],
            value: 50,
          },
        ]);

        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            expense("nadi", 100),
            registerTati,
            join("sasha", "tati"),
          ]).balance
        ).toEqual([
          {
            who: ["sasha", "tati"],
            whom: ["nadi"],
            value: 50,
          },
        ]);
      });

      it("splits expenses after separation", () => {
        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            registerTati,
            join("sasha", "tati"),
            expense("nadi", 90),
            expense("nadi", 90),
            expense("sasha", 450),
            separate("sasha", "tati"),
          ]).balance
        ).toEqual([
          {
            who: ["nadi"],
            whom: ["sasha"],
            value: 15,
          },
          {
            who: ["nadi"],
            whom: ["tati"],
            value: 15,
          },
        ]);

        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            registerTati,
            join("sasha", "tati"),
            expense("nadi", 90),
            separate("sasha", "tati"),
          ]).balance
        ).toEqual([
          {
            who: ["sasha"],
            whom: ["nadi"],
            value: 30,
          },
          {
            who: ["tati"],
            whom: ["nadi"],
            value: 30,
          },
        ]);
      });

      it("considers updated joints", () => {
        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            registerTati,
            join("sasha", "tati"),
            expense("nadi", 90),
            expense("nadi", 90),
            expense("sasha", 450),
            separate("sasha", "tati"),
            registerEd,
            join("sasha", "ed"),
          ]).balance
        ).toEqual([
          {
            who: ["nadi"],
            whom: ["sasha", "ed"],
            value: 15,
          },
          {
            who: ["nadi"],
            whom: ["tati"],
            value: 15,
          },
        ]);

        expect(
          calculateHistoryBalance([
            registerSasha,
            registerNadi,
            registerTati,
            join("sasha", "tati"),
            expense("nadi", 90),
            separate("sasha", "tati"),
          ]).balance
        ).toEqual([
          {
            who: ["sasha"],
            whom: ["nadi"],
            value: 30,
          },
          {
            who: ["tati"],
            whom: ["nadi"],
            value: 30,
          },
        ]);
      });
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

    it("supports joints", () => {
      expect(
        calculateLedgerState([
          registerSasha,
          registerNadi,
          expense("nadi", 100),
          expense("sasha", 10),
          registerTati,
          join("sasha", "tati"),
          expense("nadi", 90),
        ])
      ).toEqual({
        members: { sasha, nadi, tati },
        joints: [["sasha", "tati"]],
        splits: [
          { who: ["sasha"], whom: ["nadi"], value: 50 },
          { who: ["nadi"], whom: ["sasha"], value: 5 },
          { who: ["sasha", "tati"], whom: ["nadi"], value: 60 },
        ],
      });

      expect(
        calculateLedgerState([
          registerSasha,
          registerNadi,
          registerTati,
          join("sasha", "tati"),
          expense("nadi", 90),
          expense("nadi", 90),
          expense("sasha", 450),
        ])
      ).toEqual({
        members: { sasha, nadi, tati },
        joints: [["sasha", "tati"]],
        splits: [
          { who: ["sasha", "tati"], whom: ["nadi"], value: 60 },
          { who: ["sasha", "tati"], whom: ["nadi"], value: 60 },
          { who: ["nadi"], whom: ["sasha", "tati"], value: 150 },
        ],
      });
    });

    it("process separate", () => {
      const result = calculateLedgerState([
        registerSasha,
        registerNadi,
        expense("nadi", 100),
        expense("sasha", 10),
        registerTati,
        join("sasha", "tati"),
        expense("nadi", 90),
        separate("sasha", "tati"),
        expense("nadi", 90),
      ]);
      expect(result).toEqual({
        members: { sasha, nadi, tati },
        joints: [],
        splits: [
          { who: ["sasha"], whom: ["nadi"], value: 50 },
          { who: ["nadi"], whom: ["sasha"], value: 5 },
          { who: ["sasha", "tati"], whom: ["nadi"], value: 60 },
          { who: ["sasha"], whom: ["nadi"], value: 30 },
          { who: ["tati"], whom: ["nadi"], value: 30 },
        ],
      });
    });
  });

  describe("splitOutdatedJoints", () => {
    it("updates balance according to the latest joints state", () => {
      expect(
        splitOutdatedJoints({
          joints: [],
          splits: [{ who: ["tati", "sasha"], whom: ["nadi"], value: 30 }],
        })
      ).toEqual([
        { who: ["tati"], whom: ["nadi"], value: 15 },
        { who: ["sasha"], whom: ["nadi"], value: 15 },
      ]);

      expect(
        splitOutdatedJoints({
          joints: [],
          splits: [{ who: ["nadi"], whom: ["tati", "sasha"], value: 30 }],
        })
      ).toEqual([
        { who: ["nadi"], whom: ["tati"], value: 15 },
        { who: ["nadi"], whom: ["sasha"], value: 15 },
      ]);
    });

    it("preserves splits", () => {
      expect(
        splitOutdatedJoints({
          joints: [],
          splits: [
            { who: ["sasha"], whom: ["lesha"], value: 40 },
            { who: ["tati", "sasha"], whom: ["nadi"], value: 30 },
          ],
        })
      ).toEqual([
        { who: ["sasha"], whom: ["lesha"], value: 40 },
        { who: ["tati"], whom: ["nadi"], value: 15 },
        { who: ["sasha"], whom: ["nadi"], value: 15 },
      ]);
    });

    it("supports multiple members", () => {
      expect(
        splitOutdatedJoints({
          joints: [],
          splits: [{ who: ["tati", "sasha"], whom: ["nadi", "ed"], value: 40 }],
        })
      ).toEqual([
        { who: ["tati"], whom: ["nadi"], value: 10 },
        { who: ["tati"], whom: ["ed"], value: 10 },
        { who: ["sasha"], whom: ["nadi"], value: 10 },
        { who: ["sasha"], whom: ["ed"], value: 10 },
      ]);
    });
  });

  describe("biggestJoint", () => {
    it("find the joint that includes all the members from the given joint", () => {
      expect(
        biggestJoint(
          [
            ["a", "b"],
            ["c", "d"],
          ],
          ["c"]
        )
      ).toEqual(["c", "d"]);
    });

    it("returns the given joint if none is found", () => {
      expect(
        biggestJoint(
          [
            ["a", "b"],
            ["c", "d"],
          ],
          ["e"]
        )
      ).toEqual(["e"]);
    });

    it("returns the given joint if not all members are present", () => {
      expect(
        biggestJoint(
          [
            ["a", "b"],
            ["c", "d"],
          ],
          ["a", "c"]
        )
      ).toEqual(["a", "c"]);
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

var tati = {
  telegramId: 789,
  firstName: "Tati",
  since: new Date(),
};

var registerTati: LedgerRegisterAction = {
  type: "register",
  memberId: "tati",
  member: tati,
  createdAt: new Date(),
};

var ed = {
  telegramId: 0,
  firstName: "Ed",
  since: new Date(),
};

var registerEd: LedgerRegisterAction = {
  type: "register",
  memberId: "ed",
  member: ed,
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

function join(memberId: string, joiningMemberId: string): LedgerJoinAction {
  return {
    type: "join",
    memberId,
    joiningMemberId,
    createdAt: new Date(),
  };
}

function separate(
  memberId: string,
  separatingMemberId: string
): LedgerSeparateAction {
  return {
    type: "separate",
    memberId,
    separatingMemberId,
    createdAt: new Date(),
  };
}
