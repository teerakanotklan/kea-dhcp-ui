import { z } from 'zod';

export const IPv4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
export const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export const IpAddressSchema = z.string().regex(IPv4_REGEX, 'รูปแบบ IPv4 ไม่ถูกต้อง (เช่น 192.168.1.1)');
export type IpAddress = z.infer<typeof IpAddressSchema>;

export const MacAddressSchema = z.string().regex(MAC_REGEX, 'รูปแบบ MAC Address ไม่ถูกต้อง (เช่น AA:BB:CC:DD:EE:FF)');
export type MacAddress = z.infer<typeof MacAddressSchema>;

export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
  totalPages: z.number().int().nonnegative().default(1)
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    errors: z.array(z.string()).optional()
  });
}

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: string[];
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
};

export type NotificationType = 'success' | 'error' | 'danger' | 'warning' | 'info';

export interface NotificationState {
  type: NotificationType;
  message: string;
}
