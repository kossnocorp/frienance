import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import { LedgerExpenseAction, ledgers } from "../../db";
import base64 from "../../_lib/base64";
import { getExchangeRate } from "../../_lib/currency";
import { sendMessage } from "../../_lib/telegram";

export default async function trackExpense({
  telegramChatId,
  message,
  args,
  ledgerId,
}: {
  telegramChatId: number;
  message: Message;
  args: string;
  ledgerId: string;
}) {
  const { from } = message;

  if (from) {
    const telegramUserId = from.id;
    const memberId = base64(telegramUserId);

    const argsCaptures = args.match(/^(\d+)(?:\s(\w+))?(?: - (.+))?$/);

    if (argsCaptures) {
      const [_, valueStr, currency = "USD", comment] = argsCaptures;
      const val = parseInt(valueStr);

      // TODO: Validate value and currency

      console.debug(
        `Adding an expense for member (${memberId}): ${valueStr} ${currency} - ${comment}`
      );

      const exchangeRate = await getExchangeRate(currency);
      const valueUSD = exchangeRate.rate * val;

      const action: LedgerExpenseAction = {
        type: "expense",
        memberId,
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
        text: `Added an expense ${val} ${currency}${
          currency !== "USD" ? ` (${valueUSD} USD)` : ""
        }${comment ? ` - ${comment}` : ""}`,
      });
    } else {
      console.debug(
        "Ignoring the expense command as I can't parse the arguments"
      );

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/expense 100" - to add 100 USD
"/expense 100 CZK" - to add 100 CZK
"/expense 100 RUB - Beer" - to add 100 RUB with comment`,
      });
    }
  } else {
    console.debug(
      "Ignoring the register command as I can't find the sender user"
    );
  }
}
