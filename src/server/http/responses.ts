// Success responses in the shape the API contract uses (BUILD_PROMPT section 6):
//   one item: { data: {...} }
//   a list:   { data: [...], meta: { count, next_cursor, ... } }

export type ListMeta = {
  count: number;
  next_cursor: string | null;
  [extra: string]: unknown; // e.g. run_at on risk lists
};

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}

export function list<T>(data: T[], meta: ListMeta, init?: ResponseInit): Response {
  return Response.json({ data, meta }, init);
}

// 201 with a Location header pointing at the new item.
export function created<T>(data: T, location: string): Response {
  return Response.json({ data }, { status: 201, headers: { Location: location } });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
