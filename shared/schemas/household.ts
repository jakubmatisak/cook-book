import { z } from './zod'
import { HOUSEHOLD_ROLES } from '../family'

const householdName = z.string().trim().min(1, 'Zadaj názov domácnosti.').max(60)

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .max(200)
    .pipe(z.email({ error: 'Zadaj platný e-mail.' }))
    .transform((v) => v.toLowerCase()),
  role: z.enum(HOUSEHOLD_ROLES).default('member'),
})

export const memberRoleSchema = z.object({ role: z.enum(HOUSEHOLD_ROLES) })

export const householdNameSchema = z.object({ name: householdName })
