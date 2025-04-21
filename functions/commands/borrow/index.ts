import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import base64 from "../../_lib/base64";
import { getExchangeRate } from "../../_lib/currency";
import { formatValue } from "../../_lib/format";
import { findMemberByHandle } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";
import { ExchangeRate, Ledger, LedgerBorrowAction, ledgers } from "../../db";

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
      /^(\@?\w+)\s*(\d*\.\d+|\d+)(?:\s*(\w+))?(?:\s*[-–]\s*(.+))?$/
    );

    if (argsCaptures) {
      const [_, handle, valueStr, currencyStr, comment] = argsCaptures;
      const currency =
        currencyStr?.toUpperCase() || ledgerData.currency || "USD";
      const val = parseFloat(valueStr);

      const borrowingFromMemberEntry = findMemberByHandle({
        ledgerData,
        message,
        handle,
      });

      if (isNaN(val)) {
        console.debug(
          `Ignoring the borrow command as the value "${valueStr}" is not a number`
        );
        return sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: `Can't parse the value "${valueStr}", please make sure you format it correctly`,
        });
      }

      if (borrowingFromMemberEntry) {
        const [borrowingFromMemberId, borrowingFromMember] =
          borrowingFromMemberEntry;

        if (borrowingFromMemberId !== memberId) {
          console.debug(
            `Adding a money borrow from member ${memberId} to ${borrowingFromMemberId} ${valueStr} ${currency} - ${comment}`
          );

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

          const valueUSD = exchangeRate.rate * val;

          const action: LedgerBorrowAction = {
            type: "borrow",
            memberId,
            borrowingFromMemberId,
            value: val,
            currency,
            valueUSD,
            exchangeRate,
            comment,
            createdAt: new Date(),
          };

          await update(ledgers, ledgerId, [
            field("history", value("arrayUnion", [action])),
          ]);

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: `Added a money transfer from ${handle}: ${val} ${currency}${
              currency !== "USD" ? ` (${formatValue(valueUSD)} USD)` : ""
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
