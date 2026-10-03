import { execSync } from 'child_process';

try {
  console.log('--- GIT STATUS ---');
  const status = execSync('git status', { encoding: 'utf8' });
  console.log(status);

  console.log('--- GIT DIFF ---');
  const diff = execSync('git diff', { encoding: 'utf8' });
  console.log(diff);
} catch (err: any) {
  console.error('Error running git commands:', err.message || err);
}
