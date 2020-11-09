import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import {
  Ledger,
  LedgerBorrowAction,
  LedgerGiveAction,
  ledgers,
} from "../../db";
import base64 from "../../_lib/base64";
import { getExchangeRate } from "../../_lib/currency";
import { findMemberByHandle } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function borrowMoney({
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

    const argsCaptures = args.match(
      /^(\@?\w+)\s*(\d+)(?:\s*(\w+))?(?:\s*[-–]\s*(.+))?$/
    );

    if (argsCaptures) {
      const [_, handle, valueStr, currencyStr, comment] = argsCaptures;
      const currency = currencyStr?.toUpperCase() || "USD";
      const val = parseInt(valueStr);

      const borrowingFromMemberEntry = findMemberByHandle({
        ledgerData,
        message,
        handle,
      });

      // TODO: Validate value and currency

      if (borrowingFromMemberEntry) {
        const [
          borrowingFromMemberId,
          borrowingFromMember,
        ] = borrowingFromMemberEntry;

        if (borrowingFromMemberId !== memberId) {
          console.debug(
            `Adding a money borrow from member ${memberId} to ${borrowingFromMemberId} ${valueStr} ${currency} - ${comment}`
          );

          const exchangeRate = await getExchangeRate(currency);
          const valueUSD = exchangeRate.rate * val;

          const action: LedgerBorrowAction = {
            type: "borrow",
            memberId,
            borrowingFromMemberId,
            value: val,
            currency,
            valueUSD,
            exchangeRate,
            createdAt: new Date(),
          };

          await update(ledgers, ledgerId, [
            field("history", value("arrayUnion", [action])),
          ]);

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: `Added a money transfer from ${handle}: ${val} ${currency}${
              currency !== "USD" ? ` (${valueUSD} USD)` : ""
            }${comment ? ` - ${comment}` : ""}`,
          });
        } else {
          console.debug(
            "Ignoring the borrow command as the member trying to borrow the money from themselves"
          );

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: "Sorry, you can't borrow money from yourself",
          });
        }
      } else {
        console.debug(
          `Ignoring the borrow command as the member with handle "${handle} is not found in the ledger`
        );

        await sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: `Can't find the member with handle "${handle}", make sure they registered`,
        });
      }
    } else {
      console.debug(
        "Ignoring the borrow command as I can't parse the arguments"
      );

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/borrow @kossnocorp 100" - to borrow 100 USD from @kossnocorp
"/borrow 100 CZK" - to borrow 100 CZK from @kossnocorp
"/borrow 100 RUB - For beer" - to borrow 100 RUB from @kossnocorp with a comment`,
      });
    }
  } else {
    console.debug(
      "Ignoring the borrow command as I can't find the sender user"
    );
  }
}
