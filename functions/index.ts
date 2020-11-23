import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Update } from "telegram-typings";
import { get, set } from "typesaurus";
import calculateBalance from "./commands/balance";
import borrowMoney from "./commands/borrow";
import trackExpense from "./commands/expense";
import giveMoney from "./commands/give";
import joinMembers from "./commands/join";
import registerMember from "./commands/register";
import separateMembers from "./commands/separate";
import { Ledger, LedgerActionType, ledgers } from "./db";
import base64 from "./_lib/base64";

admin.initializeApp();

type BotCommand = LedgerActionType | "balance";

export const webhook = functions.https.onRequest(async (request, response) => {
  const telegramUpdate = request.body as Update;

  console.debug(
    `Got an update from Telegram (${JSON.stringify(telegramUpdate)})`
  );
  const message = telegramUpdate.message;

  if (message?.text) {
    const telegramChatId = message.chat.id;
    const ledgerId = base64(telegramChatId);
    const ledger = await get(ledgers, ledgerId);

    let ledgerData: Ledger;

    if (!ledger) {
      console.debug(
        `Couldn't find the chat ledger, bootstraing an empty one (${ledgerId})`
      );

      ledgerData = { telegramChatId, members: {}, joints: {}, history: [] };
      await set(ledgers, ledgerId, ledgerData);
    } else {
      ledgerData = ledger.data;
    }

    const captures = message.text.match(/^\/(\w+)\s?(.*)$/);
    if (captures) {
      const [_, command, args] = captures;

      console.debug(`Got a command (${command})`);

      switch (command as BotCommand) {
        case "register":
          await registerMember({
            telegramChatId,
            message,
            ledgerId,
            ledgerData,
          });
          break;

        case "join":
          await joinMembers({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

        case "separate":
          await separateMembers({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

        case "expense":
          await trackExpense({ telegramChatId, message, args, ledgerId });
          break;

        case "give":
          await giveMoney({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

        case "borrow":
          await borrowMoney({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

        case "relief":
          await reliefMember({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

        case "balance":
          await calculateBalance({
            telegramChatId,
            message,
            args,
            ledgerId,
            ledgerData,
          });
          break;

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
