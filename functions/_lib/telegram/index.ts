import * as functions from "firebase-functions";
import fetch from "node-fetch";
import FormData from "form-data";

const { token } = (functions.config().telegram || {}) as { token?: string };

export interface SendMessageProps {
  chatId: number;
  text: string;
  replyToId?: number;
}

export function sendMessage({ chatId, replyToId, text }: SendMessageProps) {
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

export interface SendDocumentProps {
  chatId: number;
  replyToId?: number;
  document: {
    content: Buffer;
    filename: string;
    contentType: string;
  };
  text?: string;
}

export function sendDocument({
  chatId,
  replyToId,
  document: { content, filename, contentType },
  text,
}: SendDocumentProps) {
  const form = new FormData();

  form.append("chat_id", chatId);
  form.append("reply_to_message_id", replyToId);
  form.append("document", content, { filename, contentType });
  form.append("caption", text);

  return fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    headers: form.getHeaders(),
    body: form,
  }).then((resp) => {
    if (!resp.ok) {
      console.debug("The message request has failed");
    }
    return resp.json();
  });
}
