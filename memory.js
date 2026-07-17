// Tiny per-contact conversation memory, stored in a JSON file on disk.
// Keeps the last N messages per WhatsApp number so the AI has thread context.
import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './history.json';
const MAX_TURNS = 10; // remember last 10 messages per contact

function load() {
  if (!existsSync(FILE)) return {};
  try { return JSON.parse(readFileSync(FILE, 'utf-8')); }
  catch { return {}; }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getHistory(number) {
  const data = load();
  return data[number] || [];
}

export function addMessage(number, role, text) {
  const data = load();
  const hist = data[number] || [];
  hist.push({ role, text });
  data[number] = hist.slice(-MAX_TURNS); // keep only the most recent
  save(data);
}
