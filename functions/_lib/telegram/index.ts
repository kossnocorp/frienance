import * as functions from "firebase-functions";
import fetch from "node-fetch";

const { token } = (functions.config().telegram || {}) as { token?: string };

export function sendMessage({
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
  }).then((resp) => {
    if (!resp.ok) {
      console.debug("The message request has failed");
    }
    return resp.json();
  });
}
