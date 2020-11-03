import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Update } from "telegram-typings";
import { collection, field, get, ref, set, update, value } from "typesaurus";
import { ExchangeRate, Ledger, LedgerActionType, User } from "./types";
import fetch from "node-fetch";

const { token } = (functions.config().telegram || {}) as { token?: string };

admin.initializeApp();

export const ledgers = collection<Ledger>("ledgers");

export const webhook = functions.https.onRequest(async (request, response) => {
  const telegramUpdate = request.body as Update;

  console.debug(
    `Got an update from Telegram (${JSON.stringify(telegramUpdate)})`
  );

  if (telegramUpdate.message?.text) {
    const telegramChatId = telegramUpdate.message.chat.id;
    const ledgerId = base64(telegramChatId);
    const ledgerRef = ref(ledgers, ledgerId);
    const ledger = await get(ledgerRef);

    let ledgerData: Ledger;

    if (!ledger) {
      console.debug(
        `Couldn't find the chat ledger, bootstraing an empty one (${ledgerId})`
      );

      ledgerData = { telegramChatId, users: {}, history: [] };
      await set(ledgerRef, ledgerData);
    } else {
      ledgerData = ledger.data;
    }

    const captures = telegramUpdate.message.text.match(/^\/(\w+)\s?(.*)$/);
    if (captures) {
      const [_, command, args] = captures;

      console.debug(`Got a command (${command})`);

      switch (command as LedgerActionType) {
        case "register": {
          const { from } = telegramUpdate.message;
          if (from) {
            const telegramUserId = from.id;
            const userId = base64(telegramUserId);

            console.debug(
              `Registering the user (${telegramUserId}) in the ledger (${ledgerId}) as (${userId})`
            );

            const user = {
              telegramId: telegramUserId,
              firstName: from.first_name,
              lastName: from.last_name,
              username: from.username,
              since: new Date(),
            };

            if (!(userId in ledgerData.users)) {
              const action = {
                type: "register",
                userId,
                user,
                createdAt: new Date(),
              };

              await update(ledgerRef, [
                field(["users", userId], user),
                field("history", value("arrayUnion", [action])),
              ]);

              await sendMessage({
                chatId: telegramChatId,
                replyToId: telegramUpdate.message.message_id,
                text: `${fullName(user)} has been registered in the ledger`,
              });
            } else {
              console.debug(
                `The user (${userId}) is already in the ledger, ignoring the command`
              );

              await sendMessage({
                chatId: telegramChatId,
                replyToId: telegramUpdate.message.message_id,
                text: `${fullName(user)} is already in the ledger!`,
              });
            }
          } else {
            console.debug(
              "Ignoring the register command as I can't find the sender user"
            );
          }
          break;
        }

        case "expense": {
          const { from } = telegramUpdate.message;
          if (from) {
            const telegramUserId = from.id;
            const userId = base64(telegramUserId);

            const argsCaptures = args.match(/^(\d+)(?:\s(\w+))?(?: - (.+))?$/);

            if (argsCaptures) {
              const [_, valueStr, currency = "USD", comment] = argsCaptures;
              const val = parseInt(valueStr);

              // TODO: Validate value and currency

              console.debug(
                `Adding an expense for user (${userId}): ${valueStr} ${currency} - ${comment}`
              );

              const exchangeRate = await getExchangeRate(currency);
              const valueUSD = exchangeRate.rate * val;

              const action = {
                type: "expense",
                userId,
                value: val,
                currency,
                valueUSD,
                exchangeRate,
                createdAt: new Date(),
              };

              await update(ledgerRef, [
                field("history", value("arrayUnion", [action])),
              ]);

              await sendMessage({
                chatId: telegramChatId,
                replyToId: telegramUpdate.message.message_id,
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
                replyToId: telegramUpdate.message.message_id,
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
          break;
        }

        default:
          console.debug(`Ignoring unknown command (${command})`);
      }
    } else {
      console.debug("The update is ignored as I can't parse the command");
    }
  } else {
    console.debug("The update is ignored as I can't find message text");
  }

  response.send("OK");
});

function sendMessage({
  chatId,
  replyToId,
  text,
}: {
  chatId: number;
  text: string;
  replyToId?: number;
}) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_notification: true,
      reply_to_message_id: replyToId,
    }),
  })
    .then((resp) => resp.json())
    .then((d) => console.log("----++-+++--", d));
}

export type ExchangeRateResponse = {
  rates: {
    USD: number;
  };
  base: string;
  date: string; // "2020-11-02"
};

async function getExchangeRate(base: string): Promise<ExchangeRate> {
  if (base === "USD") {
    return {
      base: "USD",
      rate: 1,
      date: new Date(),
    };
  }

  const response = await fetch(
    `https://api.exchangeratesapi.io/latest?base=${base}&symbols=USD`
  );
  const json = (await response.json()) as ExchangeRateResponse;
  console.log("++++", json);
  return {
    base,
    rate: json.rates.USD,
    date: new Date(),
  };
}

function fullName(user: User) {
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
}

function base64(data: any) {
  const buffer = Buffer.from(String(data));
  return buffer.toString("base64");
}
