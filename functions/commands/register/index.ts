import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import { Ledger, LedgerRegisterAction, ledgers } from "../../db";
import base64 from "../../_lib/base64";
import { fullName } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function registerMember({
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
  const { from } = message;

  if (from) {
    const telegramUserId = from.id;
    const memberId = base64(telegramUserId);

    console.debug(
      `Registering the user (${telegramUserId}) in the ledger (${ledgerId}) as (${memberId})`
    );

    const member = {
      telegramId: telegramUserId,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      since: new Date(),
    };

    if (!(memberId in ledgerData.members)) {
      const action: LedgerRegisterAction = {
        type: "register",
        memberId,
        member,
        createdAt: new Date(),
      };

      await update(ledgers, ledgerId, [
        field(["members", memberId], member),
        field("history", value("arrayUnion", [action])),
      ]);

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `${fullName(member)} has been registered in the ledger`,
      });
    } else {
      console.debug(
        `The user (${memberId}) is already in the ledger, ignoring the command`
      );

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `${fullName(member)} is already in the ledger!`,
      });
    }
  } else {
    console.debug(
      "Ignoring the register command as I can't find the sender user"
    );
  }
}
