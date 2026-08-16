import { describe, expect, it } from "vitest";
import { readAuthorizedEventPage, type StreamEvent } from "./authorized-stream";
import type { Principal } from "../security/control";

const principal: Principal = {
  kind: "human", id: "viewer-1", authenticated: true,
  grants: [{ workspaceId: "workspace-1", projectIds: ["project-1"], role: "viewer" }]
};
const events: StreamEvent[] = [
  { cursor: 1, workspaceId: "workspace-1", projectId: "project-1", type: "task", payload: "one" },
  { cursor: 2, workspaceId: "workspace-1", projectId: "project-2", type: "secret", payload: "filtered" },
  { cursor: 3, workspaceId: "workspace-1", projectId: "project-1", type: "task", payload: "three" }
];

describe("authorized event stream", () => {
  it("recovers from a cursor and filters every event by authorized project", () => {
    expect(readAuthorizedEventPage(events, principal, "workspace-1", "project-1", 1)).toEqual({
      events: [events[2]], nextCursor: 3, hasMore: false
    });
  });

  it("denies unauthenticated and cross-project streams", () => {
    expect(() => readAuthorizedEventPage(events, undefined, "workspace-1", "project-1", 0)).toThrow("Authentication");
    expect(() => readAuthorizedEventPage(events, principal, "workspace-1", "project-2", 0)).toThrow("not authorized");
  });

  it("paginates deterministically without losing the recovery cursor", () => {
    expect(readAuthorizedEventPage(events, principal, "workspace-1", "project-1", 0, 1)).toMatchObject({
      events: [events[0]], nextCursor: 1, hasMore: true
    });
  });
});
