import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const required = (value, name) => {
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const request = async (fetchImpl, baseUrl, token, path, init = {}) => {
  const response = await fetchImpl(new URL(path, baseUrl), {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-Key": token, ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} failed with HTTP ${response.status}`);
  return body;
};

export async function deployPortainer({
  fetchImpl = fetch,
  baseUrl,
  token,
  stackId,
  endpointId,
  image,
  timeoutMs = 180_000,
  intervalMs = 2_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!Number.isInteger(stackId) || stackId < 1) throw new Error("stackId must be a positive integer");
  if (!Number.isInteger(endpointId) || endpointId < 1) throw new Error("endpointId must be a positive integer");
  if (!/^ghcr\.io\/jeffersonarpasserini\/spock-workspace-dashboard:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/.test(image)) {
    throw new Error("image must be an immutable dashboard image from GHCR");
  }

  const stackPath = `/api/stacks/${stackId}?endpointId=${endpointId}`;
  const stack = await request(fetchImpl, baseUrl, token, stackPath);
  if (Number(stack.EndpointId) !== endpointId) throw new Error("Portainer stack endpoint does not match the configured endpoint");
  if (!Array.isArray(stack.Env)) throw new Error("Portainer stack environment is unavailable");

  let imageVariables = 0;
  const env = stack.Env.map((entry) => {
    if (entry.name !== "SPOCK_DASHBOARD_IMAGE") return entry;
    imageVariables += 1;
    return { ...entry, value: image };
  });
  if (imageVariables !== 1) throw new Error("Portainer stack must define exactly one SPOCK_DASHBOARD_IMAGE");

  const file = await request(fetchImpl, baseUrl, token, `/api/stacks/${stackId}/file?endpointId=${endpointId}`);
  if (typeof file.StackFileContent !== "string") throw new Error("Portainer stack file is unavailable");
  const pullPolicies = file.StackFileContent.match(/pull_policy: (?:never|always)/g) ?? [];
  if (pullPolicies.length !== 1) throw new Error("Portainer stack must have exactly one dashboard pull policy");

  await request(fetchImpl, baseUrl, token, stackPath, {
    method: "PUT",
    body: JSON.stringify({
      StackFileContent: file.StackFileContent.replace("pull_policy: never", "pull_policy: always"),
      Env: env,
      Prune: false,
      RepullImageAndRedeploy: true,
    }),
  });

  const filters = encodeURIComponent(JSON.stringify({
    label: ["com.docker.compose.project=spock-dashboard-portainer", "com.docker.compose.service=dashboard"],
  }));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const containers = await request(fetchImpl, baseUrl, token,
      `/api/endpoints/${endpointId}/docker/containers/json?all=1&filters=${filters}`);
    if (Array.isArray(containers) && containers.length === 1 && containers[0].Id) {
      const container = await request(fetchImpl, baseUrl, token,
        `/api/endpoints/${endpointId}/docker/containers/${containers[0].Id}/json`);
      if (container.Config?.Image === image && container.State?.Running && container.State?.Health?.Status === "healthy") {
        return;
      }
    }
    await sleep(intervalMs);
  }
  throw new Error("Portainer did not start a healthy dashboard from the requested image before timeout");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const timeoutSeconds = Number.parseInt(process.env.DEPLOY_TIMEOUT_SECONDS ?? "180", 10);
  await deployPortainer({
    baseUrl: required(process.env.PORTAINER_URL, "PORTAINER_URL"),
    token: required(process.env.PORTAINER_ACCESS_TOKEN, "PORTAINER_ACCESS_TOKEN"),
    stackId: Number.parseInt(process.env.PORTAINER_STACK_ID ?? "6", 10),
    endpointId: Number.parseInt(process.env.PORTAINER_ENDPOINT_ID ?? "4", 10),
    image: required(process.env.SPOCK_DASHBOARD_IMAGE, "SPOCK_DASHBOARD_IMAGE"),
    timeoutMs: timeoutSeconds * 1_000,
  });
  console.log("Portainer deployed the requested dashboard image");
}
