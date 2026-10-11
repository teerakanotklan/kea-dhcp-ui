export interface KeaAgentResponse<T = Record<string, unknown>> {
  result: number;
  text?: string;
  arguments?: T;
}

export interface KeaCommandResult<T = Record<string, unknown>> {
  success: boolean;
  resultCode: number;
  message?: string;
  data: T;
}

export function parseKeaResponse<T = Record<string, unknown>>(
  rawData: string,
  commandName: string
): KeaAgentResponse<T> {
  try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0] as KeaAgentResponse<T>;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed as KeaAgentResponse<T>;
    }
    throw new Error('Unexpected Kea response format');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Kea Control Agent response for '${commandName}': ${errorMsg}`);
  }
}
