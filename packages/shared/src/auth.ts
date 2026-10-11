import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'operator', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().or(z.number()),
  username: z.string().min(1, 'ต้องระบุชื่อผู้ใช้'),
  role: UserRoleSchema.default('admin'),
  name: z.string().optional()
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'กรุณาระบุ Username'),
  password: z.string().min(1, 'กรุณาระบุ Password')
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseDataSchema = z.object({
  token: z.string(),
  user: UserSchema
});
export type LoginResponseData = z.infer<typeof LoginResponseDataSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณาระบุรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(6, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
