import { PrismaClient, AccessRole, OrgStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Categories with translations
  const categories = [
    {
      key: 'accounting',
      translations: {
        en: 'Accounting',
        hi: 'लेखा',
        te: 'అకౌంటింగ్',
      },
    },
    {
      key: 'bookkeeping',
      translations: {
        en: 'Bookkeeping',
        hi: 'पुस्तपालन',
        te: 'బుక్ కీపింగ్',
      },
    },
    {
      key: 'construction',
      translations: {
        en: 'Construction',
        hi: 'निर्माण',
        te: 'నిర్మాణం',
      },
    },
    {
      key: 'invoice',
      translations: {
        en: 'Invoice Management',
        hi: 'चालान प्रबंधन',
        te: 'ఇన్వాయిస్ నిర్వహణ',
      },
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { key: cat.key },
      update: { translations: cat.translations },
      create: {
        key: cat.key,
        translations: cat.translations,
      },
    });
  }
  console.log('Categories seeded.');

  // 2. Seed Projects / Sites
  const projects = [
    { name: 'Metro Station Project', location: 'Sector 62' },
    { name: 'Corporate Office Site', location: 'Hitec City' },
    { name: 'Residential Complex Site', location: 'Jubilee Hills' },
  ];

  for (const proj of projects) {
    const existing = await prisma.project.findFirst({
      where: { name: proj.name },
    });
    if (!existing) {
      await prisma.project.create({
        data: proj,
      });
    }
  }
  console.log('Projects seeded.');

  // 3. Seed default Employees
  const employees = [
    {
      name: 'Hemanth Sadineni',
      email: 'hemanth@company.com',
      phone: '+919876543210',
      employeeId: 'EMP-001',
      accessRole: AccessRole.super_admin,
      orgLevel: 7,
      address: 'Hyderabad, TS',
      bloodGroup: 'O+',
      preferredLanguage: 'en',
      status: OrgStatus.active,
    },
    {
      name: 'Rajesh Kumar',
      email: 'rajesh@company.com',
      phone: '+919876543211',
      employeeId: 'EMP-002',
      accessRole: AccessRole.admin,
      orgLevel: 5,
      address: 'Delhi, NCR',
      bloodGroup: 'A+',
      preferredLanguage: 'hi',
      status: OrgStatus.active,
    },
    {
      name: 'Srinivas Rao',
      email: 'srinivas@company.com',
      phone: '+919876543212',
      employeeId: 'EMP-003',
      accessRole: AccessRole.member,
      orgLevel: 3,
      address: 'Vijayawada, AP',
      bloodGroup: 'B+',
      preferredLanguage: 'te',
      status: OrgStatus.active,
    },
    {
      name: 'Anjali Sharma',
      email: 'anjali@company.com',
      phone: '+919876543213',
      employeeId: 'EMP-004',
      accessRole: AccessRole.member,
      orgLevel: 1,
      address: 'Mumbai, MH',
      bloodGroup: 'AB+',
      preferredLanguage: 'en',
      status: OrgStatus.active,
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: emp,
      create: emp,
    });
  }
  console.log('Employees seeded.');
  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
