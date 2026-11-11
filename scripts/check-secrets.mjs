import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const patterns = [/\bsk-ant-[A-Za-z0-9_-]{20,}\b/, /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/, /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/];
const blocked = [];
for (const file of files) {
  const name = basename(file);
  if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') { blocked.push(file); continue; }
  const text = readFileSync(file, 'utf8');
  if (patterns.some(pattern => pattern.test(text))) blocked.push(file);
}
if (blocked.length) { console.error('Không push: phát hiện file cấu hình riêng tư hoặc chuỗi giống khóa API. Chỉ hiện tên file:'); console.error(blocked.join('\n')); process.exitCode = 1; }
else console.log(`Đã kiểm tra ${files.length} file: không có .env hoặc khóa API nhận diện được trong nguồn sẽ push.`);
