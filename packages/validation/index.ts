import { z } from 'zod';

export const phoneLoginSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").optional()
});

export const emailLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").optional()
});

export const taskCreateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high", "critical", "urgent"]),
  dueDate: z.string().datetime().optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID"),
  projectId: z.string().uuid().optional().nullable(),
  assignees: z.array(z.string().uuid("Invalid assignee ID")).min(1, "At least one assignee is required")
});

export const commentCreateSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
  type: z.enum(["text", "voice"])
});

export const approvalRequestSchema = z.object({
  approverId: z.string().uuid("Invalid approver ID")
});

export const approvalDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decisionComment: z.string().min(1, "Decision comment is required")
});
