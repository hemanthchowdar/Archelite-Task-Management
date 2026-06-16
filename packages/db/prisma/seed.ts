import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { key: 'accounting' },
      update: {},
      create: {
        key: 'accounting',
        labelEn: 'Accounting',
        labelHi: 'लेखांकन',
        labelTe: 'అకౌంటింగ్'
      }
    }),
    prisma.category.upsert({
      where: { key: 'construction' },
      update: {},
      create: {
        key: 'construction',
        labelEn: 'Construction',
        labelHi: 'निर्माण',
        labelTe: 'నిర్మాణం'
      }
    }),
    prisma.category.upsert({
      where: { key: 'invoice' },
      update: {},
      create: {
        key: 'invoice',
        labelEn: 'Invoice',
        labelHi: 'चालान',
        labelTe: 'ఇన్వాయిస్'
      }
    }),
    prisma.category.upsert({
      where: { key: 'bookkeeping' },
      update: {},
      create: {
        key: 'bookkeeping',
        labelEn: 'Bookkeeping',
        labelHi: 'बहीखाता',
        labelTe: 'బుక్కీపింగ్'
      }
    }),
  ])

  // super admin employee
  const superAdmin = await prisma.employee.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@ctms.com',
      employeeId: 'EMP001',
      accessRole: 'super_admin',
      orgLevel: 7,
      preferredLanguage: 'en',
      status: 'active'
    }
  })

  // regular member
  const member = await prisma.employee.upsert({
    where: { phone: '+918888888888' },
    update: {},
    create: {
      name: 'Ravi Kumar',
      phone: '+918888888888',
      email: 'ravi@ctms.com',
      employeeId: 'EMP002',
      accessRole: 'member',
      orgLevel: 2,
      preferredLanguage: 'te',
      status: 'active'
    }
  })

  // one sample task
  const task = await prisma.task.create({
    data: {
      title: 'Review Q4 invoices',
      description: 'Go through all pending invoices for Q4 and reconcile.',
      priority: 'high',
      status: 'todo',
      createdById: superAdmin.id,
      categoryId: categories[2].id, // invoice
      assignments: {
        create: {
          employeeId: member.id,
          role: 'owner',
          assignedById: superAdmin.id
        }
      }
    }
  })

  console.log('✅ Seeded:')
  console.log(`   ${categories.length} categories`)
  console.log(`   2 employees (${superAdmin.name}, ${member.name})`)
  console.log(`   1 task: "${task.title}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
