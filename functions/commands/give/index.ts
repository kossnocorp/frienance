import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import { ExchangeRate, Ledger, LedgerGiveAction, ledgers } from "../../db";
import base64 from "../../_lib/base64";
import { getExchangeRate } from "../../_lib/currency";
import { findMemberByHandle } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function giveMoney({
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

      const givingToMemberEntry = findMemberByHandle({
        ledgerData,
        message,
        handle,
      });

      // TODO: Validate value

      if (givingToMemberEntry) {
        const [givingToMemberId, givingToMember] = givingToMemberEntry;

        if (givingToMemberId !== memberId) {
          console.debug(
            `Adding a money transfer for member ${memberId} to ${givingToMemberId} ${valueStr} ${currency} - ${comment}`
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

          const action: LedgerGiveAction = {
            type: "give",
            memberId,
            givingToMemberId,
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
            text: `Added a money transfer to ${handle}: ${val} ${currency}${
              currency !== "USD" ? ` (${valueUSD} USD)` : ""
            }${comment ? ` - ${comment}` : ""}`,
          });
        } else {
          console.debug(
            "Ignoring the give command as the member trying to give the money themselves"
          );

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: "Sorry, you can't give money yourself",
          });
        }
      } else {
        console.debug(
          `Ignoring the give command as the member with handle "${handle} is not found in the ledger`
        );

        await sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: `Can't find the member with handle "${handle}", make sure they registered`,
        });
      }
    } else {
      console.debug("Ignoring the give command as I can't parse the arguments");

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/give @kossnocorp 100" - to give @kossnocorp 100 USD
"/give 100 CZK" - to give @kossnocorp 100 CZK
"/give 100 RUB - For beer" - to give @kossnocorp 100 RUB with comment`,
      });
    }
  } else {
    console.debug("Ignoring the give command as I can't find the sender user");
  }
}
