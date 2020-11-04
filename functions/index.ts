import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Update } from "telegram-typings";
import { get, ref, set } from "typesaurus";
import trackExpense from "./commands/expense";
import joinMembers from "./commands/join";
import registerMember from "./commands/register";
import { Ledger, LedgerActionType, ledgers } from "./db";
import base64 from "./_lib/base64";

admin.initializeApp();

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

      switch (command as LedgerActionType) {
        case "register": {
          registerMember({ telegramChatId, message, ledgerId, ledgerData });
          break;
        }

        case "join": {
          joinMembers({ telegramChatId, message, args, ledgerId, ledgerData });
          break;
        }

        case "expense": {
          trackExpense({ telegramChatId, message, args, ledgerId });
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
