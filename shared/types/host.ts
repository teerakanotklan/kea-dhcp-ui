import { z } from 'zod';
import { IpAddressSchema, MacAddressSchema } from './common';

export const StaticHostSchema = z.object({
  id: z.string().optional(),
  subnetId: z.union([z.string(), z.number()]).optional(),
  name: z.string().min(1, 'ต้องระบุชื่อ Host'),
  hostname: z.string().optional(),
  mac: MacAddressSchema.or(z.string()),
  ip: IpAddressSchema.or(z.string()),
  description: z.string().optional()
});
export type StaticHost = z.infer<typeof StaticHostSchema>;

export const StaticHostFormDataSchema = z.object({
  name: z.string().min(1, 'ต้องระบุชื่อ Host'),
  mac: MacAddressSchema,
  ip: IpAddressSchema,
  description: z.string().optional()
});
export type StaticHostFormData = z.infer<typeof StaticHostFormDataSchema>;
