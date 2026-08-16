import { authorize, type Principal } from "../security/control";

export interface StreamEvent<T = unknown> {
  cursor: number;
  workspaceId: string;
  projectId: string;
  type: string;
  payload: T;
}

export interface StreamPage<T = unknown> {
  events: readonly StreamEvent<T>[];
  nextCursor: number;
  hasMore: boolean;
}

export function readAuthorizedEventPage<T>(
  events: readonly StreamEvent<T>[],
  principal: Principal | undefined,
  workspaceId: string,
  projectId: string,
  afterCursor: number,
  limit = 100
): StreamPage<T> {
  authorize(principal, { workspaceId, projectId, action: "stream" });
  if (!Number.isSafeInteger(afterCursor) || afterCursor < 0) throw new Error("Stream cursor is invalid");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Stream limit is invalid");
  const scoped = events
    .filter((event) => event.workspaceId === workspaceId && event.projectId === projectId && event.cursor > afterCursor)
    .sort((left, right) => left.cursor - right.cursor);
  for (let index = 1; index < scoped.length; index += 1) {
    if (scoped[index].cursor === scoped[index - 1].cursor) throw new Error("Duplicate stream cursor");
  }
  const page = scoped.slice(0, limit);
  return {
    events: page,
    nextCursor: page.at(-1)?.cursor ?? afterCursor,
    hasMore: scoped.length > page.length
  };
}
