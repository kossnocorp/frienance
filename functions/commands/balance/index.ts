import { remove, uniq } from "js-fns";
import { Message } from "telegram-typings";
import { InterfaceUnion } from "typeroo";
import { ExchangeRate, Ledger, LedgerAction, Member } from "../../db";
import { getExchangeRate } from "../../_lib/currency";
import { formatValue } from "../../_lib/format";
import { listMembers } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export interface Dept {
  who: string[];
  whom: string[];
  value: number;
}

export interface Relief {
  who: string;
  whom: string;
}

export interface CalculateBalanceProps {
  telegramChatId: number;
  message: Message;
  args: string;
  ledgerId: string;
  ledgerData: Ledger;
}

export default async function calculateBalance({
  telegramChatId,
  message,
  args,
  ledgerId,
  ledgerData,
}: CalculateBalanceProps) {
  console.debug(`Calculating balance for the ledger (${ledgerId})`);

  const { members, joints, balance } = calculateLedgerBalance(
    ledgerData.history
  );

  const argsCaptures = args.match(/^(\w+)/);
  const currency = argsCaptures?.[1].toUpperCase() || "USD";

  let exchangeRate: ExchangeRate;
  try {
    exchangeRate = await getExchangeRate(currency);
  } catch (err) {
    console.debug(`Failed to get exchange rate for ${currency}`);
    return sendMessage({
      chatId: telegramChatId,
      replyToId: message.message_id,
      text: `Can't get exchange rate for ${currency}, please make sure that you use valid currency code`,
    });
  }

  function formatMessageValue(value: number) {
    return (
      `${formatValue(value / exchangeRate.rate)} ${currency}` +
      (currency !== "USD" ? ` (${formatValue(value)} USD)` : "")
    );
  }

  await sendMessage({
    chatId: telegramChatId,
    replyToId: message.message_id,
    text: balance
      .map((d) => {
        const who = d.who.map((id) => members[id]);
        const whom = d.whom.map((id) => members[id]);
        return `${listMembers(who)} owes ${listMembers(
          whom
        )} ${formatMessageValue(d.value)}`;
      })
      .join("\n\n"),
  });
}

export interface LedgerBalance {
  members: Record<string, Member>;
  joints: string[][];
  balance: Dept[];
}

/**
 *
 * @param history - the ledger actions history
 * @returns
 */
export function calculateLedgerBalance(history: LedgerAction[]): LedgerBalance {
  const { members, joints, operations } = calculateLedgerState(history);

  const balance: Dept[] = [];

  splitOutdatedJoints({ joints, operations }).forEach((operation) => {
    if (operation.type === "relief") {
      const relief = operation.relief;
      for (let i = balance.length - 1; i >= 0; i--) {
        const dept = balance[i];
        if (dept.who.includes(relief.whom) && dept.whom.includes(relief.who)) {
          balance.splice(i, 1);
        }
      }
      return;
    }

    const split = operation.dept;

    // First check if "whom" is in dept to repay it
    const whomDeptIndex = balance.findIndex(
      (s) =>
        jointIncludes(s.who, split.whom) && jointIncludes(s.whom, split.who)
    );

    if (whomDeptIndex !== -1) {
      const whomDept = balance[whomDeptIndex];

      if (whomDept.value > split.value) {
        // Dept is bigger than the current split, so simply repay dept
        whomDept.value -= split.value;
      } else {
        // Dept is less or equal, so remove it and create new final split

        balance.splice(whomDeptIndex, 1);

        const restValue = whomDept.value - split.value;
        if (restValue !== 0) {
          balance.push({
            who: biggestJoint(joints, split.who),
            whom: biggestJoint(joints, split.whom),
            value: Math.abs(restValue),
          });
        }
      }

      return;
    }

    // Now check if "who" is already in dept to sum up it
    const whoDeptIndex = balance.findIndex(
      (s) =>
        jointIncludes(s.who, split.who) && jointIncludes(s.whom, split.whom)
    );

    if (whoDeptIndex !== -1) {
      const whoDept = balance[whoDeptIndex];
      whoDept.value += split.value;
      return;
    }

    // Nothing found in the final splits, add the split clone
    balance.push({
      who: biggestJoint(joints, split.who),
      whom: biggestJoint(joints, split.whom),
      value: split.value,
    });
  });

  return { members, joints, balance };
}

export type LedgerOperation = InterfaceUnion<
  LedgerOperationDept,
  LedgerOperationRelief
>;

export interface LedgerOperationDept {
  type: "dept";
  dept: Dept;
}

export interface LedgerOperationRelief {
  type: "relief";
  relief: Relief;
}

/**
 * The ledger state that holds all the information required to calculate
 * the balance.
 */
export interface LedgerState {
  members: Record<string, Member>;
  joints: string[][];
  operations: LedgerOperation[];
}

/**
 * Calculate the ledger state (active members, who owns who, etc.) from
 * the actions history.
 *
 * @param history - the ledger actions history
 * @returns actual ledger state
 */
export function calculateLedgerState(history: LedgerAction[]): LedgerState {
  const members: Record<string, Member> = {};
  const joints: string[][] = [];
  const operations: LedgerOperation[] = [];

  history.forEach((action) => {
    switch (action.type) {
      case "register": {
        members[action.memberId] = action.member;
        break;
      }

      case "expense": {
        const splitWith = Object.entries(members).filter(
          ([id]) => action.memberId !== id
        );
        const membersCount = splitWith.length + 1;
        const value = action.valueUSD / membersCount;

        const splitWithGroups: string[][] = [];
        splitWith.forEach(([memberId, member]) => {
          const group = splitWithGroups.find((group) =>
            group.includes(memberId)
          );
          if (!group) {
            const joint = joints.find((joint) => joint.includes(memberId));
            if (joint && joint.includes(action.memberId)) return;
            splitWithGroups.push(joint || [memberId]);
          }
        });

        splitWithGroups.forEach((who) => {
          operations.push({
            type: "dept",
            dept: {
              who,
              whom: biggestJoint(joints, [action.memberId]),
              value: value * who.length,
            },
          });
        });

        break;
      }

      case "give": {
        operations.push({
          type: "dept",
          dept: {
            who: biggestJoint(joints, [action.givingToMemberId]),
            whom: biggestJoint(joints, [action.memberId]),
            value: action.valueUSD,
          },
        });
        break;
      }

      case "borrow": {
        operations.push({
          type: "dept",
          dept: {
            who: biggestJoint(joints, [action.memberId]),
            whom: biggestJoint(joints, [action.borrowingFromMemberId]),
            value: action.valueUSD,
          },
        });
        break;
      }

      case "join": {
        const jointIndex = joints.findIndex(
          (j) =>
            j.includes(action.memberId) || j.includes(action.joiningMemberId)
        );
        const joint = joints[jointIndex];

        if (joint) {
          joints[jointIndex] = uniq(
            joint.concat([action.memberId, action.joiningMemberId])
          );
        } else {
          joints.push([action.memberId, action.joiningMemberId]);
        }
        break;
      }

      case "separate": {
        const jointIndex = joints.findIndex(
          (j) =>
            j.includes(action.memberId) && j.includes(action.separatingMemberId)
        );
        const joint = joints[jointIndex];

        if (joint) {
          joints[jointIndex] = remove(joint, action.separatingMemberId);
          if (joints[jointIndex].length === 1) joints.splice(jointIndex, 1);
        }
        break;
      }

      case "relief": {
        operations.push({
          type: "relief",
          relief: {
            who: action.memberId,
            whom: action.relievingMemberId,
          },
        });
        break;
      }
    }
  });

  return { members, joints, operations };
}

export interface SplitOutdatedJointsProps {
  joints: string[][];
  operations: LedgerOperation[];
}

export function splitOutdatedJoints({
  joints,
  operations,
}: SplitOutdatedJointsProps): LedgerOperation[] {
  const processedOperations: LedgerOperation[] = [];

  operations.forEach((operation) => {
    if (operation.type === "relief") {
      processedOperations.push(operation);
      return;
    }

    const dept = operation.dept;

    const whoJointFound =
      dept.who.length === 1 || joints.find((j) => equalJoints(j, dept.who));
    const whomJointFound =
      dept.whom.length === 1 || joints.find((j) => equalJoints(j, dept.whom));

    if (!whoJointFound && !whomJointFound) {
      const value = dept.value / (dept.who.length + dept.whom.length);
      dept.who.forEach((who) => {
        dept.whom.forEach((whom) => {
          processedOperations.push({
            type: "dept",
            dept: {
              who: [who],
              whom: [whom],
              value,
            },
          });
        });
      });
    } else if (!whoJointFound) {
      const value = dept.value / dept.who.length;
      dept.who.forEach((who) => {
        processedOperations.push({
          type: "dept",
          dept: {
            who: [who],
            whom: dept.whom,
            value,
          },
        });
      });
    } else if (!whomJointFound) {
      const value = dept.value / dept.whom.length;
      dept.whom.forEach((whom) => {
        processedOperations.push({
          type: "dept",
          dept: {
            who: dept.who,
            whom: [whom],
            value,
          },
        });
      });
    } else {
      processedOperations.push(operation);
    }
  });

  return processedOperations;
}

export function equalJoints(a: string[], b: string[]) {
  return a.length === b.length && a.every((i) => b.includes(i));
}

export function biggestJoint(joints: string[][], joint: string[]) {
  return joints.find((j) => jointIncludes(j, joint)) || joint;
}

function jointIncludes(joint: string[], jointToCheckForInclude: string[]) {
  return jointToCheckForInclude.every((m) => joint.includes(m));
}
