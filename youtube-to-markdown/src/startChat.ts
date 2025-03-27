import { startPolicyChat } from './chat/policyChat';
import { initDb } from './database/schema';

async function main() {
  console.log('Initializing database...');
  await initDb();
  
  console.log('Starting policy chat interface...');
  await startPolicyChat();
}

main().catch(error => {
  console.error('Error starting application:', error);
  process.exit(1);
}); 