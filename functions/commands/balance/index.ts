import { remove, uniq } from "js-fns";
import { Message } from "telegram-typings";
import { Ledger, LedgerAction, Member } from "../../db";
import { listMembers } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export type Dept = {
  who: string[];
  whom: string[];
  value: number;
};

export default async function calculateBalance({
  telegramChatId,
  message,
  ledgerId,
  ledgerData,
}: {
  telegramChatId: number;
  message: Message;
  ledgerId: string;
  ledgerData: Ledger;
}) {
  console.debug(`Calculating balance for the ledger (${ledgerId})`);

  const { members, joints, balance } = calculateHistoryBalance(
    ledgerData.history
  );

  await sendMessage({
    chatId: telegramChatId,
    replyToId: message.message_id,
    text: balance
      .map((d) => {
        const who = d.who.map((id) => members[id]);
        const whom = d.whom.map((id) => members[id]);
        return `${listMembers(who)} owes ${listMembers(whom)} ${d.value} USD`;
      })
      .join("\n\n"),
  });
}

export function calculateHistoryBalance(history: LedgerAction[]) {
  const { members, joints, splits } = calculateLedgerState(history);

  const balance: Dept[] = [];

  splitOutdatedJoints({ joints, splits }).forEach((split) => {
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

export function calculateLedgerState(history: LedgerAction[]) {
  const members: Record<string, Member> = {};
  const joints: string[][] = [];
  const splits: Dept[] = [];

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
          splits.push({
            who,
            whom: biggestJoint(joints, [action.memberId]),
            value: value * who.length,
          });
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
    }
  });

  return { members, joints, splits };
}

export function splitOutdatedJoints({
  joints,
  splits,
}: {
  joints: string[][];
  splits: Dept[];
}): Dept[] {
  const balance: Dept[] = [];

  splits.forEach((split) => {
    const whoJointFound =
      split.who.length === 1 || joints.find((j) => equalJoints(j, split.who));
    const whomJointFound =
      split.whom.length === 1 || joints.find((j) => equalJoints(j, split.whom));

    if (!whoJointFound && !whomJointFound) {
      const value = split.value / (split.who.length + split.whom.length);
      split.who.forEach((who) => {
        split.whom.forEach((whom) => {
          balance.push({
            who: [who],
            whom: [whom],
            value,
          });
        });
      });
    } else if (!whoJointFound) {
      const value = split.value / split.who.length;
      split.who.forEach((who) => {
        balance.push({
          who: [who],
          whom: split.whom,
          value,
        });
      });
    } else if (!whomJointFound) {
      const value = split.value / split.whom.length;
      split.whom.forEach((whom) => {
        balance.push({
          who: split.who,
          whom: [whom],
          value,
        });
      });
    } else {
      balance.push(split);
    }
  });

  return balance;
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
