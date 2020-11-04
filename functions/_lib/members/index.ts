import { last } from "js-fns";
import { Member } from "../../db";

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
