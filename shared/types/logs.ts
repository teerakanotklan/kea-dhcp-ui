import { z } from 'zod';

export const LogLevelSchema = z.enum([
  'all',
  'DEBUG',
  'INFO',
  'NOTICE',
  'WARN',
  'WARNING',
  'ERROR',
  'FATAL'
]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const ServiceLogEntrySchema = z.object({
  id: z.union([z.string(), z.number()]),
  timestamp: z.string(),
  service: z.string().optional(),
  level: z.string(),
  category: z.string().optional(),
  message: z.string(),
  raw: z.string().optional(),
  pid: z.union([z.number(), z.string()]).optional(),
  details: z.record(z.string(), z.any()).optional()
});
export type ServiceLogEntry = z.infer<typeof ServiceLogEntrySchema>;
