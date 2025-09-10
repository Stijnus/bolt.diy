// Simple Node.js script to test Sentry configuration
import { exec } from 'child_process';

console.log('🔍 Testing Sentry Configuration...\n');

// Check if Sentry CLI is available
exec('npx @sentry/cli --version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Sentry CLI not available:', error.message);
    return;
  }

  console.log('✅ Sentry CLI version:', stdout.trim());

  // Check auth token
  console.log('\n🔑 Checking auth token...');
  exec('npx @sentry/cli info', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Auth token issue:', error.message);
      console.log('💡 Make sure your .sentryclirc file has the correct token');
      return;
    }

    console.log('✅ Auth token valid');
    console.log('📊 Organization info:', stdout);

    // Test a simple request
    console.log('\n🌐 Testing Sentry endpoint connectivity...');
    exec('curl -s -o /dev/null -w "%{http_code}" https://sentry.io/api/0/organizations/nastman/', (error, stdout, stderr) => {
      if (stdout === '200') {
        console.log('✅ Sentry API reachable');
      } else {
        console.log('⚠️  Sentry API response:', stdout);
      }

      console.log('\n📝 Next steps:');
      console.log('1. Start your dev server: npm run dev');
      console.log('2. Go to Settings → Development Tools');
      console.log('3. Use the SentryTest component to verify functionality');
      console.log('4. Check browser Network tab for Sentry requests');
      console.log('5. Check your Sentry dashboard for incoming events');
    });
  });
});
