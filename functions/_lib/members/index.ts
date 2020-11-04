import { Member } from "../../db";

export function fullName(message: Member) {
  return message.lastName
    ? `${message.firstName} ${message.lastName}`
    : message.firstName;
}
