export function deployPortainer(options: {
  fetchImpl?: (input: URL | string, init?: RequestInit) => Promise<Response>;
  baseUrl: string;
  token: string;
  stackId: number;
  endpointId: number;
  image: string;
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<void>;
