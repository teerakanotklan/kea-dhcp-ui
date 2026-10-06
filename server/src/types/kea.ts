export interface KeaOptionData {
  name: string;
  data: string;
  space?: string;
  csv_format?: boolean;
}

export interface KeaPool {
  pool: string;
}

export interface KeaReservation {
  'hw-address'?: string;
  'ip-address'?: string;
  hostname?: string;
  comments?: string;
  [key: string]: unknown;
}

export interface KeaSubnet4 {
  id: number;
  subnet: string;
  comment?: string;
  pools?: KeaPool[];
  'option-data'?: KeaOptionData[];
  reservations?: KeaReservation[];
  'valid-lifetime'?: number;
  'user-context'?: Record<string, unknown>;
  _disabled?: boolean;
  [key: string]: unknown;
}

export interface KeaDhcp4Config {
  subnet4?: KeaSubnet4[];
  'valid-lifetime'?: number;
  'renew-timer'?: number;
  'rebind-timer'?: number;
  authoritative?: boolean;
  'option-data'?: KeaOptionData[];
  'control-socket'?: {
    'socket-type'?: string;
    'socket-name'?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KeaRootConfig {
  Dhcp4?: KeaDhcp4Config;
  [key: string]: unknown;
}

export interface KeaAgentResponse<T = Record<string, unknown>> {
  result: number;
  text?: string;
  arguments?: T;
}

export interface KeaRawLease {
  'ip-address'?: string;
  ip?: string;
  'hw-address'?: string;
  mac?: string;
  hostname?: string;
  'valid-lft'?: number | string;
  validLft?: number | string;
  cltt?: number | string;
  state?: number;
  'subnet-id'?: number;
  [key: string]: unknown;
}
