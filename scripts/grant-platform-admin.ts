import { prisma } from "../src/lib/prisma";
const email=String(process.argv[2]||"").trim().toLowerCase();
if(!email)throw new Error("Usage: npm run platform:grant -- administrator@company.com");
const result=await prisma.user.updateMany({where:{email,role:"SUPER_ADMIN"},data:{isPlatformAdmin:true}});
if(result.count!==1)throw new Error("A matching SUPER_ADMIN account was not found.");
console.log(`Platform administration granted to ${email}.`);
await prisma.$disconnect();
