#!/usr/bin/env node

/**
 * Quick local Gun.js server test
 * Run this to verify gun server works locally before deployment
 */

const Gun = require('gun');

console.log('🧪 Testing Gun.js locally...');

// Test 1: Create Gun instance with different configurations
const gun1 = Gun({ 
  localStorage: false, 
  radisk: false,
  file: 'test-data-1'
});
const gun2 = Gun({ 
  localStorage: false, 
  radisk: false,
  file: 'test-data-2'
});

console.log('✅ Gun instances created');

// Test 2: Data sync between instances
let messagesReceived = 0;
const testMessage = {
  text: 'Local sync test',
  timestamp: Date.now(),
  author: 'TestScript'
};

// Instance 1 listens
gun1.get('test-sync').on((data, key) => {
  if (data && data.text === testMessage.text) {
    messagesReceived++;
    console.log(`✅ Message received by gun1:`, data);
    
    if (messagesReceived === 2) {
      console.log('🎉 Local Gun.js sync test PASSED!');
      process.exit(0);
    }
  }
});

// Instance 2 listens
gun2.get('test-sync').on((data, key) => {
  if (data && data.text === testMessage.text) {
    messagesReceived++;
    console.log(`✅ Message received by gun2:`, data);
    
    if (messagesReceived === 2) {
      console.log('🎉 Local Gun.js sync test PASSED!');
      process.exit(0);
    }
  }
});

// Instance 1 sends message
setTimeout(() => {
  const messageId = `test_${Date.now()}`;
  gun1.get('test-sync').get(messageId).put(testMessage);
  console.log('📤 Message sent from gun1');
}, 1000);

// Timeout if no sync
setTimeout(() => {
  console.log('❌ Local sync test FAILED - timeout');
  process.exit(1);
}, 5000);
