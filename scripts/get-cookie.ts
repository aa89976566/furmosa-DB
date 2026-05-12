// 開發小工具：產生一個有效 session cookie 給 curl 用
import { signSession } from '../lib/auth';
import { prisma } from '../lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@furmosa.com' } });
  if (!user) {
    console.error('admin@furmosa.com 不存在');
    process.exit(1);
  }
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  console.log(token);
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
