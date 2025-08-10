#!/usr/bin/env node

// Simple client test: connect to local Gun relay and verify write/read
const Gun = require('gun');

const ENDPOINT = process.env.GUN_URL || 'http://localhost:8765';
const ROOM = 'diag-test';

console.log('🔫 Gun client test starting...');
console.log('➡️  Connecting to', ENDPOINT);

const gun = Gun({
  peers: [ENDPOINT],
  localStorage: false,
  radisk: false,
});

const ref = gun.get(ROOM);
const msg = { text: 'hello from client', ts: Date.now() };
const key = `msg_${Date.now()}`;

let got = false;

// Listen for data back
ref.map().on((data, k) => {
  if (!data || !data.text) return;
  console.log('📥 Received:', { k, data });
  if (k === key && data.text === msg.text) {
    got = true;
    console.log('✅ Sync OK');
    process.exit(0);
  }
});

// Write message after a short delay to ensure subscription is set
setTimeout(() => {
  console.log('📤 Sending:', { key, msg });
  ref.get(key).put(msg);
}, 800);

// Timeout safeguard
setTimeout(() => {
  if (!got) {
    console.error('❌ Sync FAILED: timeout waiting for echoed data');
    process.exit(1);
  }
}, 7000);
