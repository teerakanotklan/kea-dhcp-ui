import { z } from 'zod';
import { IpAddressSchema } from './common';

export const DhcpCustomOptionSchema = z.object({
  name: z.string(),
  value: z.string(),
  code: z.number().optional(),
  isCustom: z.boolean().optional()
});
export type DhcpCustomOption = z.infer<typeof DhcpCustomOptionSchema>;

export const ScopeReservationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  hostname: z.string(),
  mac: z.string(),
  ip: z.string(),
  description: z.string().optional()
});
export type ScopeReservation = z.infer<typeof ScopeReservationSchema>;

export const SubnetStatsSchema = z.object({
  total: z.number().int().nonnegative().default(0),
  active: z.number().int().nonnegative().default(0),
  available: z.number().int().nonnegative().default(0),
  percentage: z.number().default(0)
});
export type SubnetStats = z.infer<typeof SubnetStatsSchema>;

export const SubnetSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  subnet: z.string(),
  subnetCidr: z.string().optional(),
  netmask: z.string(),
  cidr: z.number().optional(),
  rangeStart: z.string().optional(),
  rangeEnd: z.string().optional(),
  routers: z.string().optional(),
  domainNameServers: z.string().optional(),
  domainName: z.string().optional(),
  defaultLeaseTime: z.number().optional().default(4000),
  disabled: z.boolean().optional().default(false),
  options: z.array(DhcpCustomOptionSchema).optional(),
  reservations: z.array(ScopeReservationSchema).optional().default([]),
  stats: SubnetStatsSchema.optional()
});
export type Subnet = z.infer<typeof SubnetSchema>;

export const SubnetFormDataSchema = z.object({
  name: z.string().min(1, 'ต้องระบุชื่อ Scope'),
  subnet: IpAddressSchema,
  netmask: IpAddressSchema,
  disabled: z.boolean().default(false),
  rangeStart: IpAddressSchema.or(z.literal('')),
  rangeEnd: IpAddressSchema.or(z.literal('')),
  routers: z.string().optional(),
  domainNameServers: z.string().optional(),
  domainName: z.string().optional(),
  defaultLeaseTime: z.coerce.number().positive('เวลา Lease ต้องมากกว่า 0 วินาที').default(4000)
});
export type SubnetFormData = z.infer<typeof SubnetFormDataSchema>;
