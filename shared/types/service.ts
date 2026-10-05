import { z } from 'zod';

export const ServiceActionSchema = z.enum(['start', 'stop', 'restart', 'reload']);
export type ServiceAction = z.infer<typeof ServiceActionSchema>;

export const ServiceStatusStateSchema = z.enum(['active', 'inactive', 'failed', 'unknown']);
export type ServiceStatusState = z.infer<typeof ServiceStatusStateSchema>;

export const ServiceDaemonStatusSchema = z.object({
  service: z.string().optional(),
  active: z.boolean(),
  status: z.string(),
  pid: z.union([z.number(), z.string()]).nullable().optional(),
  since: z.string().nullable().optional(),
  raw: z.string().optional(),
  error: z.string().optional()
});
export type ServiceDaemonStatus = z.infer<typeof ServiceDaemonStatusSchema>;

export const DhcpServiceStatusSchema = z.object({
  service: z.string().optional(),
  active: z.boolean().optional(),
  status: ServiceStatusStateSchema.or(z.string()),
  uptime: z.string().optional(),
  memory: z.string().optional(),
  pid: z.union([z.number(), z.string()]).nullable().optional(),
  since: z.string().nullable().optional(),
  dhcp4: ServiceDaemonStatusSchema.optional(),
  ctrlAgent: ServiceDaemonStatusSchema.optional(),
  subnetsCount: z.number().int().nonnegative().optional(),
  activeLeasesCount: z.number().int().nonnegative().optional(),
  totalPoolsCount: z.number().int().nonnegative().optional()
});
export type DhcpServiceStatus = z.infer<typeof DhcpServiceStatusSchema>;

export const SubnetStatItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  subnet: z.string(),
  netmask: z.string().optional(),
  cidr: z.number().optional(),
  range: z.string().optional(),
  capacity: z.number().default(0),
  reservationsCount: z.number().default(0),
  activeLeases: z.number().default(0),
  utilization: z.number().default(0)
});
export type SubnetStatItem = z.infer<typeof SubnetStatItemSchema>;

export const SystemMetricSchema = z.object({
  cpuUsage: z.number().optional(),
  memoryUsage: z.number().optional(),
  totalMemory: z.string().optional(),
  freeMemory: z.string().optional(),
  uptime: z.number().optional()
});
export type SystemMetric = z.infer<typeof SystemMetricSchema>;

export const DashboardDataSchema = z.object({
  service: DhcpServiceStatusSchema.optional(),
  serviceStatus: DhcpServiceStatusSchema.optional(),
  counts: z.object({
    subnets: z.number().default(0),
    staticHosts: z.number().default(0),
    activeLeases: z.number().default(0),
    expiredLeases: z.number().default(0),
    totalCapacity: z.number().default(0),
    utilizationPercentage: z.number().default(0)
  }).optional(),
  scopesCount: z.number().int().nonnegative().optional(),
  activeLeasesCount: z.number().int().nonnegative().optional(),
  totalLeasesCount: z.number().int().nonnegative().optional(),
  staticHostsCount: z.number().int().nonnegative().optional(),
  utilizationRate: z.number().optional(),
  subnetStats: z.array(SubnetStatItemSchema).optional(),
  recentLeases: z.array(z.any()).optional().default([])
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;
