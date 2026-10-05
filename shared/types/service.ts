import { z } from 'zod';

export const ServiceActionSchema = z.enum(['start', 'stop', 'restart', 'reload']);
export type ServiceAction = z.infer<typeof ServiceActionSchema>;

export const ServiceStatusStateSchema = z.enum(['active', 'inactive', 'failed', 'unknown']);
export type ServiceStatusState = z.infer<typeof ServiceStatusStateSchema>;

export const DhcpServiceStatusSchema = z.object({
  status: ServiceStatusStateSchema.or(z.string()),
  uptime: z.string().optional(),
  memory: z.string().optional(),
  pid: z.union([z.number(), z.string()]).optional(),
  subnetsCount: z.number().int().nonnegative().optional(),
  activeLeasesCount: z.number().int().nonnegative().optional(),
  totalPoolsCount: z.number().int().nonnegative().optional()
});
export type DhcpServiceStatus = z.infer<typeof DhcpServiceStatusSchema>;

export const SystemMetricSchema = z.object({
  cpuUsage: z.number().optional(),
  memoryUsage: z.number().optional(),
  totalMemory: z.string().optional(),
  freeMemory: z.string().optional(),
  uptime: z.number().optional()
});
export type SystemMetric = z.infer<typeof SystemMetricSchema>;

export const DashboardDataSchema = z.object({
  serviceStatus: DhcpServiceStatusSchema.optional(),
  scopesCount: z.number().int().nonnegative().default(0),
  activeLeasesCount: z.number().int().nonnegative().default(0),
  totalLeasesCount: z.number().int().nonnegative().default(0),
  staticHostsCount: z.number().int().nonnegative().default(0),
  utilizationRate: z.number().default(0),
  recentLeases: z.array(z.any()).optional().default([])
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;
