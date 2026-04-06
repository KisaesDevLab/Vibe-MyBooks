import crypto from 'crypto';

const dbPassword = crypto.randomBytes(16).toString('base64url');
const jwtSecret = crypto.randomBytes(64).toString('hex');
const backupKey = crypto.randomBytes(32).toString('hex');
const redisPassword = crypto.randomBytes(16).toString('base64url');

console.log('===========================================');
console.log('  Vibe MyBooks — Generated Secrets');
console.log('===========================================');
console.log('');
console.log('DATABASE_PASSWORD=' + dbPassword);
console.log('JWT_SECRET=' + jwtSecret);
console.log('BACKUP_ENCRYPTION_KEY=' + backupKey);
console.log('REDIS_PASSWORD=' + redisPassword);
console.log('');
console.log('⚠️  Save these now — they will not be shown again.');
console.log('===========================================');
