import { z } from 'zod';
import { IpAddressSchema, MacAddressSchema } from './common';

export const LeaseStatusSchema = z.enum([
  'active',
  'reserved',
  'conflict',
  'expired',
  'declined',
  'abandoned',
  'released'
]);
export type LeaseStatus = z.infer<typeof LeaseStatusSchema>;

export const DhcpLeaseSchema = z.object({
  ip: IpAddressSchema.or(z.string()),
  mac: MacAddressSchema.or(z.string()),
  hostname: z.string().nullable().optional(),
  status: LeaseStatusSchema.or(z.string()),
  starts: z.string().nullable().optional(),
  ends: z.string().nullable().optional(),
  remainingSeconds: z.number().optional(),
  cltt: z.number().optional(),
  validLft: z.number().optional(),
  subnetId: z.union([z.string(), z.number()]).optional(),
  clientIdentifier: z.string().nullable().optional(),
  isStaticMatch: z.boolean().optional(),
  isConflict: z.boolean().optional()
});
export type DhcpLease = z.infer<typeof DhcpLeaseSchema>;

export const LeaseStatsSchema = z.object({
  total: z.number().int().nonnegative().default(0),
  active: z.number().int().nonnegative().default(0),
  expired: z.number().int().nonnegative().default(0),
  reserved: z.number().int().nonnegative().default(0),
  declined: z.number().int().nonnegative().default(0)
});
export type LeaseStats = z.infer<typeof LeaseStatsSchema>;
