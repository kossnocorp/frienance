import { intlFormat } from "date-fns";
import { Message } from "telegram-typings";
import {
  ExchangeRate,
  Ledger,
  LedgerAction,
  LedgerActionValuedBase,
} from "../../db";
import { getExchangeRate } from "../../_lib/currency";
import { formatValue } from "../../_lib/format";
import { fullName } from "../../_lib/members";
import { sendDocument, sendMessage } from "../../_lib/telegram";
import { calculateLedgerBalance, formatBalance } from "../balance";

export interface CalculateBalanceProps {
  telegramChatId: number;
  message: Message;
  args: string;
  ledgerId: string;
  ledgerData: Ledger;
}

export default async function generateHistory({
  telegramChatId,
  message,
  args,
  ledgerId,
  ledgerData,
}: CalculateBalanceProps) {
  console.debug(`Generating history for the ledger (${ledgerId})`);

  const argsCaptures = args.match(/^(\w+)/);
  const currency =
    argsCaptures?.[1].toUpperCase() || ledgerData.currency || "USD";

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

  function formatMessageValue(value: number) {
    return (
      `${formatValue(value / exchangeRate.rate)} ${currency}` +
      (currency !== "USD" ? ` (${formatValue(value)} USD)` : "")
    );
  }

  const balance = calculateLedgerBalance(ledgerData.history);

  const date = new Date();
  const dateStr = formatTime(date);
  const title = `Frienance operations history ${dateStr}`;

  const history = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  </head>

  <body class="prose-xl p-16">
    <h2>${title}</h2>

    <h2>Current balance</h2>

    <p>
      ${formatBalance({
        balance,
        formatMessageValue,
      })}
    </p>

    <h2>Actions history</h2>

    <table class="table-auto">
      <thead>
        <tr>
          <th>When</th>
          <th>What</th>
          <th>Comment</th>
          <th>Balance</th>
        </tr>
      </thead>

      <tbody>
        ${ledgerData.history
          .map((action, index) => {
            const intermediateHistory = ledgerData.history.slice(0, index + 1);
            const balance = calculateLedgerBalance(intermediateHistory);

            return `<tr>
            <td>${formatTime(action.createdAt)}</td>
            <td>${formatAction({ action, ledgerData })}</td>
            <td>${action.comment || ""}</td>
            <td>
              <details>
                <summary>Show</summary>
                ${formatBalance({ balance, formatMessageValue })}
              </details>
            </td>
          </tr>`;
          })
          .join("\n")}
      </tbody>
    </table>
  </body>
</html>`;

  await sendDocument({
    chatId: telegramChatId,
    replyToId: message.message_id,
    text: "💸 Here's your operations history",
    document: {
      content: Buffer.from(history),
      filename: `frienance-history-${date.toISOString()}.html`,
      contentType: "text/html",
    },
  });
}

export interface FormatActionProps {
  action: LedgerAction;
  ledgerData: Ledger;
}

function formatAction({
  action,
  ledgerData: { members },
}: FormatActionProps): string {
  switch (action.type) {
    case "borrow": {
      const who = fullName(members[action.memberId]);
      const whom = fullName(members[action.borrowingFromMemberId]);
      return `${who} borrowed ${formatActionValue(action)} from ${whom}`;
    }

    case "expense": {
      const who = fullName(members[action.memberId]);
      return `${who} registered an expense ${formatActionValue(action)}`;
    }

    case "give": {
      const who = fullName(members[action.memberId]);
      const whom = fullName(members[action.givingToMemberId]);
      return `${who} gave ${formatActionValue(action)} to ${whom}`;
    }

    case "join": {
      const who = fullName(members[action.memberId]);
      const whom = fullName(members[action.joiningMemberId]);
      return `${who} joined ${whom}`;
    }

    case "register": {
      const who = fullName(members[action.memberId]);
      return `${who} registered in the ledger`;
    }

    case "relief": {
      const who = fullName(members[action.memberId]);
      const whom = fullName(members[action.relievingMemberId]);
      return `${who} relieved ${whom}'s dept`;
    }

    case "separate": {
      const who = fullName(members[action.memberId]);
      const whom = fullName(members[action.separatingMemberId]);
      return `${who} separated from ${whom}`;
    }
  }
}

function formatActionValue<Action extends LedgerActionValuedBase>(
  action: Action
): string {
  return `${action.value} ${action.currency}${
    action.currency !== "USD" ? ` (${action.valueUSD} USD)` : ""
  }`;
}

function formatTime(date: Date) {
  return intlFormat(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}
