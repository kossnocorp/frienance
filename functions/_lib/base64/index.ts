export default function base64(data: any) {
  const buffer = Buffer.from(String(data));
  return buffer.toString("base64");
}
