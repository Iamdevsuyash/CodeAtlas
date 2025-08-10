#!/usr/bin/env node

/**
 * Gun.js Server Sync Diagnostic Tool
 * Tests connection, CORS, and real-time syncing functionality
 */

const Gun = require('gun');
// Prefer Node 18+ global fetch, fallback to node-fetch if not available
const fetchFn = (typeof fetch !== 'undefined') ? fetch : require('node-fetch');

const TEST_CONFIG = {
  // Test both local and production endpoints
  endpoints: [
    'http://localhost:8765',
    'https://codeatlas-gunjs.onrender.com'
  ],
  testData: {
    testKey: 'diagnostic_test',
    message: {
      text: 'Diagnostic test message',
      timestamp: Date.now(),
      author: 'DiagnosticTool'
    }
  }
};

class GunDiagnostic {
  constructor() {
    this.results = [];
  }

  log(test, status, message, details = null) {
    const result = {
      test,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.results.push(result);
    
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${test}: ${message}`);
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  async testHealthEndpoint(endpoint) {
    try {
      const response = await fetchFn(`${endpoint}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log(
          `Health Check - ${endpoint}`,
          'PASS',
          'Server is responding',
          { status: response.status, data }
        );
        return true;
      } else {
        this.log(
          `Health Check - ${endpoint}`,
          'FAIL',
          `Server returned ${response.status}`,
          { status: response.status, statusText: response.statusText }
        );
        return false;
      }
    } catch (error) {
      this.log(
        `Health Check - ${endpoint}`,
        'FAIL',
        'Connection failed',
        { error: error.message }
      );
      return false;
    }
  }

  async testCORSHeaders(endpoint) {
    try {
      const response = await fetchFn(`${endpoint}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://gitatlas.netlify.app',
          'Access-Control-Request-Method': 'GET'
        }
      });

      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-credentials': response.headers.get('access-control-allow-credentials')
      };

      if (corsHeaders['access-control-allow-origin']) {
        this.log(
          `CORS Check - ${endpoint}`,
          'PASS',
          'CORS headers present',
          corsHeaders
        );
        return true;
      } else {
        this.log(
          `CORS Check - ${endpoint}`,
          'FAIL',
          'Missing CORS headers',
          corsHeaders
        );
        return false;
      }
    } catch (error) {
      this.log(
        `CORS Check - ${endpoint}`,
        'FAIL',
        'CORS test failed',
        { error: error.message }
      );
      return false;
    }
  }

  async testGunConnection(endpoint) {
    return new Promise((resolve) => {
      try {
        console.log(`\n🔫 Testing Gun.js connection to: ${endpoint}`);
        
        const gun = Gun({
          peers: [endpoint],
          localStorage: false,
          radisk: false
        });

        let connected = false;
        let messageReceived = false;
        
        // Test connection timeout
        const timeout = setTimeout(() => {
          if (!connected) {
            this.log(
              `Gun Connection - ${endpoint}`,
              'FAIL',
              'Connection timeout (10s)',
              { endpoint: `${endpoint}/gun` }
            );
            gun.off();
            resolve(false);
          }
        }, 10000);

        // Test data write and read
        const testRef = gun.get(TEST_CONFIG.testData.testKey);
        
        // Listen for data
        testRef.on((data, key) => {
          if (data && data.text === TEST_CONFIG.testData.message.text) {
            messageReceived = true;
            clearTimeout(timeout);
            this.log(
              `Gun Sync - ${endpoint}`,
              'PASS',
              'Data sync successful',
              { received: data, key }
            );
            gun.off();
            resolve(true);
          }
        });

        // Write test data
        setTimeout(() => {
          const messageId = `msg_${Date.now()}`;
          testRef.get(messageId).put(TEST_CONFIG.testData.message);
          connected = true;
          
          this.log(
            `Gun Connection - ${endpoint}`,
            'PASS',
            'Connection established',
            { messageId, endpoint: `${endpoint}/gun` }
          );

          // Give some time for sync
          setTimeout(() => {
            if (!messageReceived) {
              clearTimeout(timeout);
              this.log(
                `Gun Sync - ${endpoint}`,
                'FAIL',
                'Data sync failed - no response received',
                { sent: TEST_CONFIG.testData.message }
              );
              gun.off();
              resolve(false);
            }
          }, 5000);
        }, 1000);

      } catch (error) {
        this.log(
          `Gun Connection - ${endpoint}`,
          'FAIL',
          'Gun.js initialization failed',
          { error: error.message }
        );
        resolve(false);
      }
    });
  }

  async runDiagnostics() {
    console.log('🔍 Starting Gun.js Server Sync Diagnostics...\n');

    for (const endpoint of TEST_CONFIG.endpoints) {
      console.log(`\n📡 Testing endpoint: ${endpoint}`);
      console.log('=' + '='.repeat(50));

      // Test 1: Health endpoint
      const healthOk = await this.testHealthEndpoint(endpoint);
      
      if (healthOk) {
        // Test 2: CORS headers
        await this.testCORSHeaders(endpoint);
        
        // Test 3: Gun.js connection and sync
        await this.testGunConnection(endpoint);
      } else {
        this.log(
          `Skipping further tests - ${endpoint}`,
          'WARN',
          'Server not responding, skipping Gun.js tests'
        );
      }
    }

    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('='.repeat(60));

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length
    };

    console.log(`\n📈 Summary:`);
    console.log(`   Total Tests: ${summary.total}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   ⚠️  Warnings: ${summary.warnings}`);

    if (summary.failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   • ${result.test}: ${result.message}`);
        });
    }

    console.log(`\n💡 Recommendations:`);
    
    if (summary.failed === 0) {
      console.log(`   🎉 All tests passed! Gun.js sync should be working properly.`);
    } else {
      console.log(`   🔧 Issues detected. Check the following:`);
      console.log(`      1. Verify server deployment and environment variables`);
      console.log(`      2. Check CORS_ORIGINS configuration`);
      console.log(`      3. Ensure Gun.js versions match between client and server`);
      console.log(`      4. Verify network connectivity and firewall settings`);
    }

    // Save detailed report
    const reportPath = './gun-diagnostic-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify({
      summary,
      results: this.results,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run diagnostics if called directly
if (require.main === module) {
  const diagnostic = new GunDiagnostic();
  diagnostic.runDiagnostics().catch(console.error);
}

module.exports = GunDiagnostic;
