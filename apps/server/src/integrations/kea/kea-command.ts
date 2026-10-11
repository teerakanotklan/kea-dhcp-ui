export const KEA_COMMANDS = {
  CONFIG_GET: 'config-get',
  CONFIG_SET: 'config-set',
  CONFIG_WRITE: 'config-write',
  LEASE4_GET_ALL: 'lease4-get-all',
  LEASE4_DEL: 'lease4-del',
  STATUS_GET: 'status-get',
  VERSION_GET: 'version-get',
  HA_SYNC: 'ha-sync',
  SHUTDOWN: 'shutdown'
} as const;

export type KeaCommandType = (typeof KEA_COMMANDS)[keyof typeof KEA_COMMANDS] | string;

export interface KeaCommandPayload {
  command: string;
  service: string[];
  arguments?: Record<string, unknown>;
}

export function buildCommandPayload(
  command: string,
  service: string | string[] = ['dhcp4'],
  args: Record<string, unknown> = {}
): KeaCommandPayload {
  const payload: KeaCommandPayload = {
    command,
    service: Array.isArray(service) ? service : [service]
  };

  if (args && typeof args === 'object' && Object.keys(args).length > 0) {
    payload.arguments = args;
  }

  return payload;
}
