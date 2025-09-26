declare module 'better-sqlite3' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement<T = unknown> {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): T;
    all(...params: unknown[]): T[];
  }

  export interface Database {
    prepare<T = unknown>(sql: string): Statement<T>;
    exec(sql: string): Database;
    pragma(query: string): unknown;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }

  interface DatabaseConstructor {
    new (filename: string): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}
