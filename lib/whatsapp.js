// Thin wrapper over the WhatsApp Cloud API send endpoint.
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GRAPH = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

// Send a plain text message. Returns true on success, false on failure.
export async function sendWhatsApp(to, body) {
  const res = await fetch(GRAPH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    console.error('Send failed:', res.status, await res.text());
    return false;
  }
  console.log('Send OK to', to);
  return true;
}
