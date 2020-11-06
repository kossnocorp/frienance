import { remove } from "js-fns";
import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import { Joint, Ledger, ledgers, LedgerSeparateAction } from "../../db";
import base64 from "../../_lib/base64";
import { findMemberByHandle, fullName, listMembers } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function separateMembers({
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

    const separatingMemberEntry = findMemberByHandle({
      ledgerData,
      message,
      handle: args,
    });

    if (separatingMemberEntry) {
      const [separatingMemberId, separatingMember] = separatingMemberEntry;

      if (separatingMemberId !== memberId) {
        const action: LedgerSeparateAction = {
          type: "separate",
          memberId,
          separatingMemberId,
          createdAt: new Date(),
        };

        let jointId: string;
        let joint: Joint;
        const jointEntry = Object.entries(ledgerData.joints).find(
          ([_, joint]) =>
            joint.memberIds.includes(memberId) &&
            joint.memberIds.includes(separatingMemberId)
        );
        if (jointEntry) {
          jointId = jointEntry[0];
          joint = {
            memberIds: remove(jointEntry[1].memberIds, separatingMemberId),
          };

          await update(ledgers, ledgerId, [
            field(
              ["joints", jointId],
              joint.memberIds.length > 1 ? joint : value("remove")
            ),
            field("history", value("arrayUnion", [action])),
          ]);

          const members = [ledgerData.members[memberId], separatingMember];
          const restMembers = joint.memberIds.map(
            (id) => ledgerData.members[id]
          );

          sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text:
              `${listMembers(members)} now have separate finances` +
              (joint.memberIds.length > 1
                ? ` (${fullName(separatingMember)} has left ${listMembers(
                    restMembers
                  )})`
                : ""),
          });
        } else {
          console.debug(
            "Ignoring the separate command as the members are not joined"
          );

          await sendMessage({
            chatId: telegramChatId,
            replyToId: message.message_id,
            text: "You're not joined with the member",
          });
        }
      } else {
        console.debug(
          "Ignoring the join command as the member trying to separate with themselves"
        );

        await sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: "Sorry, you can't separate with yourself",
        });
      }
    } else {
      console.debug(
        "Ignoring the separate command as I can't parse the arguments"
      );

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/separate @kossnocorp" - to separate with @kossnocorp`,
      });
    }
  } else {
    console.debug(
      "Ignoring the separate command as I can't find the sender user"
    );
  }
}
