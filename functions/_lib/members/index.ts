import { last } from "js-fns";
import { Message } from "telegram-typings";
import { Ledger, Member } from "../../db";

export function fullName(message: Member) {
  return message.lastName
    ? `${message.firstName} ${message.lastName}`
    : message.firstName;
}

export function listMembers(members: Member[]) {
  if (members.length === 1) return fullName(members[0]);
  return `${members
    .slice(0, members.length - 1)
    .map(fullName)
    .join(", ")} and ${fullName(last(members)!)}`;
}

export function findMemberByHandle({
  ledgerData,
  message,
  handle,
}: {
  ledgerData: Ledger;
  message: Message;
  handle: string;
}): [memberId: string, member: Member] | undefined {
  const usernameCaptures = handle.match(/^\@(.+)/);
  if (usernameCaptures) {
    const username = usernameCaptures[1];
    return Object.entries(ledgerData.members).find(
      ([_, member]) => member.username === username
    );
  } else {
    const entity = message.entities?.find((e) => e.type === "text_mention");
    const id = entity?.user?.id;
    return Object.entries(ledgerData.members).find(
      ([_, member]) => member.telegramId === id
    );
  }
}
