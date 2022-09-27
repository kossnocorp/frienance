import { Message } from "telegram-typings";
import { update } from "typesaurus";
import { ExchangeRate, Ledger, ledgers } from "../../db";
import { getExchangeRate } from "../../_lib/currency";
import { sendMessage } from "../../_lib/telegram";

export interface SetCurrencyProps {
  telegramChatId: number;
  message: Message;
  args: string;
  ledgerId: string;
}

export default async function setCurrency({
  telegramChatId,
  message,
  args,
  ledgerId,
}: SetCurrencyProps) {
  console.debug(`Setting the default currency for the ledger (${ledgerId})`);

  const argsCaptures = args.match(/^(\w+)/);
  const currency = argsCaptures?.[1].toUpperCase();

  if (!currency) {
    console.debug("Currency is missing in the command");
    return sendMessage({
      chatId: telegramChatId,
      replyToId: message.message_id,
      text: `Can't parse the command, please make sure you format it correctly:

      "/currency IDR" - to set default currency to Indonesian Rupee
      "/currency SGD" - to set default currency to Singapore Dollar`,
    });
  }

  let exchangeRate: ExchangeRate;
  try {
    exchangeRate = await getExchangeRate(currency);
  } catch (err) {
    console.debug(`Failed to get exchange rate for ${currency}`);
    return sendMessage({
      chatId: telegramChatId,
      replyToId: message.message_id,
      text: `Unknown currency ${currency}, make sure you used the correct code (i.e., SGD, USD, etc.)`,
    });
  }

  await update(ledgers, ledgerId, { currency });

  await sendMessage({
    chatId: telegramChatId,
    replyToId: message.message_id,
    text: `The default currency is now set to ${currency}, and all future operations without explicitly specifying the currency will use it.`,
  });
}
