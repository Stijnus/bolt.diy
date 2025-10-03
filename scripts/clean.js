import { rm, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rmAsync = promisify(rm);

// Comprehensive list of directories and files to clean
const dirsToRemove = [
  // Build outputs
  'dist',
  'build',
  '.remix',
  '.wrangler',
  
  // Cache directories
  'node_modules/.vite',
  'node_modules/.cache',
  '.cache',
  '.vite',
  '.temp',
  '.tmp',
  
  // Electron build artifacts
  'electron/dist',
  'electron/build',
  
  // Test artifacts
  'coverage',
  '.nyc_output',
  
  // ESLint cache
  '.eslintcache',
  
  // TypeScript cache
  '*.tsbuildinfo',
  'tsconfig.tsbuildinfo'
];

console.log('🧹 Starting comprehensive project cleanup...');

async function cleanDirectories() {
  console.log('\n📂 Removing build artifacts and cache directories...');
  
  for (const dir of dirsToRemove) {
    const fullPath = join(__dirname, '..', dir);
    
    try {
      if (existsSync(fullPath)) {
        console.log(`  Removing ${dir}...`);
        await rmAsync(fullPath, { recursive: true, force: true });
        console.log(`  ✓ Removed ${dir}`);
      }
    } catch (err) {
      console.error(`  ❌ Error removing ${dir}:`, err.message);
    }
  }
}

function runCommand(command, description) {
  try {
    console.log(`\n${description}`);
    execSync(command, { stdio: 'inherit', cwd: join(__dirname, '..') });
    console.log(`✓ ${description.replace(/^\W+\s*/, '').replace(/\.\.\.$/, '')} completed`);
  } catch (err) {
    console.error(`❌ Error during ${description.toLowerCase()}:`, err.message);
    throw err;
  }
}

async function main() {
  try {
    // Clean directories first
    await cleanDirectories();
    
    // Clear pnpm cache and store
    runCommand('pnpm store prune', '🗑️  Pruning pnpm store...');
    
    // Remove and reinstall dependencies
    console.log('\n📦 Reinstalling dependencies...');
    if (existsSync(join(__dirname, '..', 'node_modules'))) {
      console.log('  Removing node_modules...');
      await rmAsync(join(__dirname, '..', 'node_modules'), { recursive: true, force: true });
      console.log('  ✓ Removed node_modules');
    }
    
    if (existsSync(join(__dirname, '..', 'pnpm-lock.yaml'))) {
      console.log('  Removing pnpm-lock.yaml...');
      await rmAsync(join(__dirname, '..', 'pnpm-lock.yaml'), { force: true });
      console.log('  ✓ Removed pnpm-lock.yaml');
    }
    
    runCommand('pnpm install --frozen-lockfile=false', '📦 Installing fresh dependencies...');
    
    // Clean and update Wrangler
    console.log('\n☁️  Updating Wrangler configuration...');
    runCommand('pnpm wrangler kv:namespace list 2>/dev/null || true', '  Checking Wrangler connectivity...');
    runCommand('pnpm typegen', '🔧 Generating fresh Wrangler types...');
    
    // Build verification
    console.log('\n🏗️  Building and verifying project...');
    runCommand('pnpm build', '🏗️  Building project...');
    runCommand('pnpm typecheck', '🔍 Type checking...');
    
    // Success message
    console.log('\n✨ Comprehensive cleanup completed successfully!');
    console.log('\n🚀 Your project is now clean and ready. You can run:');
    console.log('   • pnpm dev          - Start development server');
    console.log('   • pnpm start        - Start production server with Wrangler');
    console.log('   • pnpm deploy       - Deploy to Cloudflare Pages');
    
  } catch (err) {
    console.error('\n💥 Cleanup failed:', err.message);
    console.log('\n🛠️  Try running individual commands manually:');
    console.log('   1. rm -rf node_modules dist build .cache');
    console.log('   2. pnpm install');
    console.log('   3. pnpm build');
    process.exit(1);
  }
}

main();
