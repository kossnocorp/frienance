import { uniq } from "js-fns";
import { nanoid } from "nanoid";
import { Message } from "telegram-typings";
import { field, update, value } from "typesaurus";
import { Joint, Ledger, LedgerJoinAction, ledgers, Member } from "../../db";
import base64 from "../../_lib/base64";
import { listMembers } from "../../_lib/members";
import { sendMessage } from "../../_lib/telegram";

export default async function joinMembers({
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

    let joiningMemberEntry: [memberId: string, member: Member] | undefined;
    const usernameCaptures = args.match(/^@(.+)/);
    if (usernameCaptures) {
      const username = usernameCaptures[1];
      joiningMemberEntry = Object.entries(ledgerData.members).find(
        ([_, member]) => member.username === username
      );
    } else {
      const entity = message.entities?.find((e) => e.type === "text_mention");
      const id = entity?.user?.id;
      joiningMemberEntry = Object.entries(ledgerData.members).find(
        ([_, member]) => member.telegramId === id
      );
    }

    if (joiningMemberEntry) {
      const [joiningMemberId, joinginMember] = joiningMemberEntry;

      if (joiningMemberId !== memberId) {
        const action: LedgerJoinAction = {
          type: "join",
          memberId,
          joiningMemberId,
          createdAt: new Date(),
        };

        let jointId: string;
        let joint: Joint;
        const jointEntry = Object.entries(ledgerData.joints).find(
          ([_, joint]) =>
            joint.memberIds.includes(memberId) ||
            joint.memberIds.includes(joiningMemberId)
        );
        if (jointEntry) {
          jointId = jointEntry[0];
          joint = {
            memberIds: uniq(
              jointEntry[1].memberIds.concat([memberId, joiningMemberId])
            ),
          };
        } else {
          jointId = nanoid();
          joint = {
            memberIds: [memberId, joiningMemberId],
          };
        }

        await update(ledgers, ledgerId, [
          field(["joints", jointId], joint),
          field("history", value("arrayUnion", [action])),
        ]);

        const members = joint.memberIds.map((id) => ledgerData.members[id]);

        sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: `${listMembers(members)} now have joint finances`,
        });
      } else {
        console.debug(
          "Ignoring the join command as the member trying to join with themselves"
        );

        await sendMessage({
          chatId: telegramChatId,
          replyToId: message.message_id,
          text: "Sorry, you can't join with yourself",
        });
      }
    } else {
      console.debug("Ignoring the join command as I can't parse the arguments");

      await sendMessage({
        chatId: telegramChatId,
        replyToId: message.message_id,
        text: `Can't parse the command, please make sure you format it correctly:

"/join @kossnocorp" - to join with @kossnocorp`,
      });
    }
  } else {
    console.debug(
      "Ignoring the register command as I can't find the sender user"
    );
  }
}
