import { expect, it } from "vitest";
import { deployPortainer } from "../scripts/deploy-portainer.mjs";

const image = `ghcr.io/jeffersonarpasserini/spock-workspace-dashboard:0.1.9@sha256:${"a".repeat(64)}`;

it("updates the Portainer stack to the immutable image and waits for its healthy container", async () => {
  let update: Record<string, unknown> | undefined;
  const fetchImpl = async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(input.toString());
    if (url.pathname === "/api/stacks/6" && init.method === "PUT") {
      update = JSON.parse(String(init.body));
      return Response.json({});
    }
    if (url.pathname === "/api/stacks/6") {
      return Response.json({ EndpointId: 4, Env: [{ name: "SPOCK_DASHBOARD_IMAGE", value: "spock-dashboard:v0.1.8" }] });
    }
    if (url.pathname === "/api/stacks/6/file") return Response.json({ StackFileContent: "pull_policy: never\n" });
    if (url.pathname === "/api/endpoints/4/docker/containers/json") return Response.json([{ Id: "dashboard" }]);
    if (url.pathname === "/api/endpoints/4/docker/containers/dashboard/json") {
      return Response.json({ Config: { Image: image }, State: { Running: true, Health: { Status: "healthy" } } });
    }
    return new Response(null, { status: 404 });
  };

  await deployPortainer({
    fetchImpl,
    baseUrl: "https://portainer.example/",
    token: "token",
    stackId: 6,
    endpointId: 4,
    image,
    sleep: async () => {},
  });

  expect(update).toEqual({
    StackFileContent: "pull_policy: always\n",
    Env: [{ name: "SPOCK_DASHBOARD_IMAGE", value: image }],
    Prune: false,
    RepullImageAndRedeploy: true,
  });
});
