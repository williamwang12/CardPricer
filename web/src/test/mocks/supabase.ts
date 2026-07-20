import { vi } from "vitest";

/**
 * Creates a chainable mock matching Supabase's fluent query-builder API.
 * Each method returns `this` so you can chain .from().select().eq().order() etc.
 * Call `mockResult(data, error?)` to set what the terminal call resolves to.
 */
export function createMockSupabase() {
  let result: { data: unknown; error: unknown; count?: number } = {
    data: null,
    error: null,
  };

  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "from",
    "select",
    "insert",
    "upsert",
    "update",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "is",
    "ilike",
    "not",
    "or",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis();
  }

  // rpc returns the builder itself for chaining
  builder.rpc = vi.fn().mockImplementation(() => {
    return { data: result.data, error: result.error };
  });

  // Override terminal methods to return the result
  builder.single = vi.fn().mockImplementation(() => result);
  builder.maybeSingle = vi.fn().mockImplementation(() => result);

  // Make the builder itself resolve to result when awaited directly
  // (for queries without .single())
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };

  return Object.assign(builder as Record<string, unknown>, {
    /** Set the data that the next query will return */
    mockResult(data: unknown, error: unknown = null) {
      result = { data, error };
    },
    /** Set result with count (for head:true queries) */
    mockCount(count: number) {
      result = { data: null, error: null, count };
    },
    /** Get a reference to a specific mock method for assertions */
    getMock(method: string) {
      return builder[method] as ReturnType<typeof vi.fn>;
    },
  });
}

/**
 * Creates a mock supabase that can have different results per .from() table.
 * More realistic for tests that call multiple tables.
 */
export function createMultiTableMock() {
  const tables = new Map<string, { data: unknown; error: unknown }>();
  let defaultResult: { data: unknown; error: unknown } = { data: null, error: null };

  const makeBuilder = (tableName?: string) => {
    const getResult = () => {
      if (tableName && tables.has(tableName)) {
        return tables.get(tableName)!;
      }
      return defaultResult;
    };

    const builder: Record<string, unknown> = {};

    const chainMethods = [
      "select",
      "insert",
      "upsert",
      "update",
      "delete",
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "is",
      "ilike",
      "not",
      "or",
      "order",
      "limit",
      "range",
    ];

    for (const method of chainMethods) {
      builder[method] = vi.fn().mockReturnThis();
    }

    builder.single = vi.fn().mockImplementation(() => getResult());
    builder.maybeSingle = vi.fn().mockImplementation(() => getResult());
    builder.then = (resolve: (v: unknown) => void) => {
      resolve(getResult());
      return Promise.resolve(getResult());
    };

    return builder;
  };

  const mock = {
    from: vi.fn().mockImplementation((table: string) => makeBuilder(table)),
    rpc: vi.fn().mockImplementation(() => defaultResult),
    setTableResult(table: string, data: unknown, error: unknown = null) {
      tables.set(table, { data, error });
    },
    setDefaultResult(data: unknown, error: unknown = null) {
      defaultResult = { data, error };
    },
  };

  return mock;
}
