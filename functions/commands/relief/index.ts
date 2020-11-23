import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import {
  ExchangeRate,
  Ledger,
  LedgerBorrowAction,
  LedgerGiveAction,
  LedgerReliefAction,
  ledgers,
} from "../../db";
import base64 from "../../_lib/base64";
import { getExchangeRate } from "../../_lib/currency";
import { findMemberByHandle } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function reliefMember({
  telegramChatId,
  message,
  args,
  ledgerId,
  ledgerData,
}: {
  telegramChatId: number;
  message: Message;
  args: string;
  ledgerId: string;
  ledgerData: Ledger;
}) {
  const { from } = message;

  if (from) {
    const telegramUserId = from.id;
    const memberId = base64(telegramUserId);

    const argsCaptures = args.match(/^(\@?\w+)$/);

    if (argsCaptures) {
      const handle = argsCaptures[1];

      const borrowingFromMemberEntry = findMemberByHandle({
        ledgerData,
        message,
        handle,
      });

      if (borrowingFromMemberEntry) {
        const [relievingMemberId, relievingMember] = borrowingFromMemberEntry;

        if (relievingMemberId !== memberId) {
          console.debug(
            `Adding debt relief from ${memberId} to ${relievingMemberId} (debtor)`
          );

          const action: LedgerReliefAction = {
            type: "relief",
            memberId,
            relievingMemberId,
            createdAt: new Date(),
          };

          await update(ledgers, ledgerId, [
            field("history", value("arrayUnion", [action])),
          ]);

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: `${handle}'s debt was relieved`,
          });
        } else {
          console.debug(
            "Ignoring the relief command as the member trying to relief their own debt"
          );

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: "Sorry, you can't relief your own debt",
          });
        }
      } else {
        console.debug(
          `Ignoring the relief command as the member with handle "${handle} is not found in the ledger`
        );

        await sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: `Can't find the member with handle "${handle}", make sure they registered`,
        });
      }
    } else {
      console.debug(
        "Ignoring the relief command as I can't parse the arguments"
      );

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/relief @kossnocorp" - to relief member's debt`,
      });
    }
  } else {
    console.debug(
      "Ignoring the relief command as I can't find the sender user"
    );
  }
}
