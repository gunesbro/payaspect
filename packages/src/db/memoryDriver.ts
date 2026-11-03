import type {
  DatabaseDriver,
  SQLValue,
  SQLRow,
  RunResult,
} from "./driver.ts";
import { splitStatements } from "./sql.ts";

/**
 * An in-memory SQL engine implementing the SQL subset PayAspect actually uses.
 *
 * Why this exists: the real app runs on SQLCipher via a native module, which
 * cannot execute under Node. To keep the schema, migration runner and
 * repositories genuinely testable (without mocking storage), this driver
 * interprets the same SQL text against JS data structures.
 *
 * Supported subset:
 *   - CREATE TABLE [IF NOT EXISTS] (column defs, PRIMARY KEY, FOREIGN KEY)
 *   - CREATE [UNIQUE] INDEX [IF NOT EXISTS] ... ON t(col)   (no-op)
 *   - DROP TABLE [IF EXISTS]
 *   - INSERT INTO t (cols) VALUES (?, ...) [ON CONFLICT ... DO NOTHING|UPDATE]
 *   - SELECT cols | COUNT(*) FROM t [WHERE] [ORDER BY] [LIMIT] [OFFSET]
 *   - UPDATE t SET a = ?, b = b + 1 [WHERE]
 *   - DELETE FROM t [WHERE]
 *   - Expressions: literals, ?, column refs, = <> < <= > >=, IS [NOT] NULL,
 *     AND, OR, NOT, LIKE, IN (...), CASE WHEN, arithmetic
 *   - Functions: COUNT, COALESCE, LOWER, UPPER, ABS, MAX, MIN
 *
 * Anything outside the subset throws, so unsupported SQL fails loudly in tests
 * instead of silently returning wrong data.
 */
export class MemoryDatabaseDriver implements DatabaseDriver {
  private tables = new Map<string, Table>();
  private openedKey: string | null = null;
  private txSnapshot: Map<string, Table> | null = null;
  private txDepth = 0;

  async open(key: string): Promise<void> {
    if (!key) throw new Error("A non-empty encryption key is required");
    this.openedKey = key;
  }

  async close(): Promise<void> {
    this.openedKey = null;
    this.txSnapshot = null;
    this.txDepth = 0;
  }

  async exec(sql: string): Promise<void> {
    for (const statement of splitStatements(sql)) {
      execute(this.tables, statement, []);
    }
  }

  async run(sql: string, params: SQLValue[] = []): Promise<RunResult> {
    return execute(this.tables, sql, params);
  }

  async all(sql: string, params: SQLValue[] = []): Promise<SQLRow[]> {
    const stmt = parse(sql);
    if (stmt.kind !== "select") {
      throw new Error(`Expected a SELECT statement, found ${stmt.kind.toUpperCase()}`);
    }
    return runSelect(this.tables, stmt.statement, params);
  }

  async get(sql: string, params: SQLValue[] = []): Promise<SQLRow | null> {
    const rows = await this.all(sql, params);
    return rows[0] ?? null;
  }

  async transaction<T>(fn: (tx: DatabaseDriver) => Promise<T>): Promise<T> {
    if (this.txDepth === 0) {
      // Snapshot so inner writes can be discarded if `fn` throws.
      this.txSnapshot = cloneTables(this.tables);
    }
    this.txDepth += 1;
    try {
      const result = await fn(this);
      this.txDepth -= 1;
      if (this.txDepth === 0) this.txSnapshot = null;
      return result;
    } catch (error) {
      this.txDepth -= 1;
      if (this.txDepth === 0 && this.txSnapshot) {
        this.tables = this.txSnapshot;
        this.txSnapshot = null;
      }
      throw error;
    }
  }

  // --- test helpers -------------------------------------------------------

  /** Directly seed rows (bypasses SQL) for repository-level tests. */
  _setRows(table: string, rows: SQLRow[]): void {
    this.tables.set(table, { primaryKey: [], rows: rows.map((r) => ({ ...r })) });
  }

  /** Snapshot of a table's rows, in insertion order. */
  _rows(table: string): SQLRow[] {
    return getTable(this.tables, table, true).rows.map((r) => ({ ...r }));
  }

  /** Names of all existing tables. */
  _tableNames(): string[] {
    return [...this.tables.keys()].sort();
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

interface Table {
  primaryKey: string[];
  rows: SQLRow[];
}

function cloneTables(tables: Map<string, Table>): Map<string, Table> {
  const copy = new Map<string, Table>();
  for (const [name, table] of tables) {
    copy.set(name, {
      primaryKey: [...table.primaryKey],
      rows: table.rows.map((r) => ({ ...r })),
    });
  }
  return copy;
}

function getTable(tables: Map<string, Table>, name: string, allowMissing = false): Table {
  const table = tables.get(name);
  if (!table) {
    if (allowMissing) return { primaryKey: [], rows: [] };
    throw new Error(`no such table: ${name}`);
  }
  return table;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType = "word" | "number" | "string" | "punct" | "param";

interface Token {
  type: TokenType;
  value: string;
}

const PUNCT_CHARS = "(),.*+-/=<>!;";

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i]!;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    // -- line comment
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    // /* block comment */
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    // 'string literal', with '' as an escaped quote
    if (ch === "'") {
      let value = "";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          value += "'";
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        value += sql[i];
        i += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }
    if (ch === "?") {
      tokens.push({ type: "param", value: "?" });
      i += 1;
      continue;
    }
    // Named parameters (:name, @name, $name) are treated as positional.
    if (ch === ":" || ch === "@" || ch === "$") {
      i += 1;
      while (i < sql.length && /[A-Za-z0-9_]/.test(sql[i]!)) i += 1;
      tokens.push({ type: "param", value: "?" });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < sql.length && /[0-9.]/.test(sql[i]!)) {
        num += sql[i];
        i += 1;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let word = "";
      while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i]!)) {
        word += sql[i];
        i += 1;
      }
      tokens.push({ type: "word", value: word });
      continue;
    }
    if (PUNCT_CHARS.includes(ch)) {
      const two = sql[i + 1] !== undefined ? ch + sql[i + 1] : "";
      if (two === "<=" || two === ">=" || two === "<>" || two === "!=") {
        tokens.push({ type: "punct", value: two });
        i += 2;
        continue;
      }
      tokens.push({ type: "punct", value: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unsupported character '${ch}' in SQL`);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type Expr =
  | { kind: "literal"; value: SQLValue }
  | { kind: "param"; index: number }
  | { kind: "column"; qualifier: string | null; name: string }
  | { kind: "star"; qualifier: string | null }
  | { kind: "binary"; op: string; left: Expr; right: Expr }
  | { kind: "unary"; op: "NOT" | "-"; operand: Expr }
  | { kind: "isNull"; operand: Expr; negated: boolean }
  | { kind: "like"; operand: Expr; pattern: Expr; negated: boolean }
  | { kind: "in"; operand: Expr; values: Expr[]; negated: boolean }
  | { kind: "case"; branches: { when: Expr; then: Expr }[]; elseValue: Expr | null }
  | { kind: "call"; name: string; args: Expr[] };

interface TableRef {
  name: string;
  alias: string | null;
}

interface Assignment {
  column: string;
  value: Expr;
}

interface SelectStatement {
  items: { expr: Expr; alias: string | null }[];
  from: TableRef | null;
  where: Expr | null;
  orderBy: { expr: Expr; direction: "ASC" | "DESC" }[];
  limit: Expr | null;
  offset: Expr | null;
}

type OnConflict =
  | { action: "nothing" }
  | { action: "update"; assignments: Assignment[] };

interface ColumnDef {
  name: string;
  notNull: boolean;
  defaultValue: Expr | null;
  primaryKey: boolean;
}

type Statement =
  | {
      kind: "createTable";
      name: string;
      ifNotExists: boolean;
      columns: ColumnDef[];
      primaryKey: string[];
    }
  | { kind: "createIndex"; table: string }
  | { kind: "dropTable"; name: string; ifExists: boolean }
  | {
      kind: "insert";
      table: string;
      columns: string[] | null;
      values: Expr[];
      onConflict: OnConflict | null;
    }
  | { kind: "select"; statement: SelectStatement }
  | { kind: "update"; table: string; assignments: Assignment[]; where: Expr | null }
  | { kind: "delete"; table: string; where: Expr | null }
  | { kind: "tx"; action: "BEGIN" | "COMMIT" | "ROLLBACK" };

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "CREATE", "TABLE",
  "INDEX", "UNIQUE", "IF", "NOT", "EXISTS", "PRIMARY", "KEY", "FOREIGN",
  "REFERENCES", "DEFAULT", "NULL", "ON", "CONFLICT", "DO", "NOTHING", "UPDATE",
  "SET", "DELETE", "ORDER", "BY", "ASC", "DESC", "LIMIT", "OFFSET", "AND",
  "OR", "IS", "IN", "LIKE", "AS", "BEGIN", "COMMIT", "ROLLBACK", "DROP",
  "CASE", "WHEN", "THEN", "ELSE", "END", "EXCLUDED", "TRANSACTION",
]);

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  private paramIndex = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseStatement(): Statement {
    const head = this.peekWord();
    switch (head) {
      case "CREATE":
        return this.parseCreate();
      case "INSERT":
        return this.parseInsert();
      case "SELECT":
        return { kind: "select", statement: this.parseSelect() };
      case "UPDATE":
        return this.parseUpdate();
      case "DELETE":
        return this.parseDelete();
      case "DROP":
        return this.parseDrop();
      case "BEGIN":
      case "COMMIT":
      case "ROLLBACK": {
        const action = head;
        this.pos += 1;
        this.consumeWord("TRANSACTION");
        this.expectEnd();
        return { kind: "tx", action };
      }
      default:
        throw new Error(`Unsupported SQL statement starting with '${head ?? "<end>"}'`);
    }
  }

  private parseCreate(): Statement {
    this.expectWord("CREATE");
    this.consumeWord("UNIQUE");

    if (this.consumeWord("INDEX")) {
      this.consumeIfNotExists();
      this.expectIdentifier(); // index name
      this.expectWord("ON");
      const table = this.expectIdentifier();
      // The column list / WHERE clause is irrelevant for an in-memory table.
      this.pos = this.tokens.length;
      return { kind: "createIndex", table };
    }

    this.expectWord("TABLE");
    const ifNotExists = this.consumeIfNotExists();
    const name = this.expectIdentifier();
    this.expectPunct("(");

    const columns: ColumnDef[] = [];
    const primaryKey: string[] = [];

    while (true) {
      const word = this.peekWord();
      if (word === "PRIMARY") {
        this.pos += 1;
        this.expectWord("KEY");
        this.expectPunct("(");
        primaryKey.push(this.expectIdentifier());
        while (this.consumePunct(",")) primaryKey.push(this.expectIdentifier());
        this.expectPunct(")");
        this.skipToSeparator();
      } else if (word === "FOREIGN" || word === "UNIQUE" || word === "CHECK") {
        this.skipConstraint();
      } else {
        columns.push(this.parseColumnDef());
      }
      if (this.consumePunct(",")) continue;
      break;
    }

    this.expectPunct(")");
    this.expectEnd();
    return { kind: "createTable", name, ifNotExists, columns, primaryKey };
  }

  private parseColumnDef(): ColumnDef {
    const name = this.expectIdentifier();
    const def: ColumnDef = { name, notNull: false, defaultValue: null, primaryKey: false };

    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos]!;
      if (tok.type === "punct" && (tok.value === "," || tok.value === ")")) break;

      const word = tok.type === "word" ? tok.value.toUpperCase() : null;

      if (word === "NOT" && this.peekWord(1) === "NULL") {
        def.notNull = true;
        this.pos += 2;
        continue;
      }
      if (word === "NULL") {
        this.pos += 1;
        continue;
      }
      if (word === "PRIMARY" && this.peekWord(1) === "KEY") {
        def.primaryKey = true;
        def.notNull = true;
        this.pos += 2;
        this.skipToSeparator();
        continue;
      }
      if (word === "DEFAULT") {
        this.pos += 1;
        def.defaultValue = this.parseExpr();
        continue;
      }
      if (
        word === "REFERENCES" ||
        word === "CHECK" ||
        word === "UNIQUE" ||
        word === "COLLATE"
      ) {
        this.skipConstraint();
        continue;
      }
      if (word === "CONSTRAINT") {
        this.pos += 1;
        this.expectIdentifier();
        continue;
      }
      // Column types (TEXT, INTEGER, REAL, ...) and any other modifier:
      // the in-memory engine is dynamically typed, so types are decorative.
      this.pos += 1;
    }

    return def;
  }

  /** Skip a table-level constraint body, e.g. FOREIGN KEY (a) REFERENCES b(c). */
  private skipConstraint(): void {
    let depth = 0;
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos]!;
      if (tok.type === "punct" && tok.value === "(") depth += 1;
      if (tok.type === "punct" && tok.value === ")") {
        if (depth === 0) return;
        depth -= 1;
      }
      if (tok.type === "punct" && tok.value === "," && depth === 0) return;
      this.pos += 1;
    }
  }

  /** Skip words up to the next column separator, e.g. ON DELETE SET NULL. */
  private skipToSeparator(): void {
    let depth = 0;
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos]!;
      if (tok.type === "punct" && tok.value === "(") depth += 1;
      if (tok.type === "punct" && tok.value === ")") {
        if (depth === 0) return;
        depth -= 1;
      }
      if (tok.type === "punct" && tok.value === "," && depth === 0) return;
      this.pos += 1;
    }
  }

  private parseInsert(): Statement {
    this.expectWord("INSERT");
    this.expectWord("INTO");
    const table = this.expectIdentifier();

    let columns: string[] | null = null;
    if (this.consumePunct("(")) {
      columns = [this.expectIdentifier()];
      while (this.consumePunct(",")) columns.push(this.expectIdentifier());
      this.expectPunct(")");
    }

    this.expectWord("VALUES");
    this.expectPunct("(");
    const values: Expr[] = [this.parseExpr()];
    while (this.consumePunct(",")) values.push(this.parseExpr());
    this.expectPunct(")");

    let onConflict: OnConflict | null = null;
    if (this.consumeWord("ON")) {
      this.expectWord("CONFLICT");
      if (this.consumePunct("(")) {
        this.expectIdentifier();
        while (this.consumePunct(",")) this.expectIdentifier();
        this.expectPunct(")");
      }
      this.expectWord("DO");
      if (this.consumeWord("NOTHING")) {
        onConflict = { action: "nothing" };
      } else {
        this.expectWord("UPDATE");
        this.expectWord("SET");
        onConflict = { action: "update", assignments: this.parseAssignments() };
      }
    }

    this.expectEnd();
    return { kind: "insert", table, columns, values, onConflict };
  }

  private parseAssignments(): Assignment[] {
    const assignments: Assignment[] = [];
    do {
      const column = this.expectIdentifier();
      this.expectPunct("=");
      assignments.push({ column, value: this.parseExpr() });
    } while (this.consumePunct(","));
    return assignments;
  }

  private parseSelect(): SelectStatement {
    this.expectWord("SELECT");
    this.consumeWord("DISTINCT");

    const items: { expr: Expr; alias: string | null }[] = [];
    do {
      const expr = this.parseExpr();
      let alias: string | null = null;
      if (this.consumeWord("AS")) {
        alias = this.expectIdentifier();
      } else {
        const tok = this.tokens[this.pos];
        const word = this.peekWord();
        if (tok?.type === "word" && word !== null && !KEYWORDS.has(word)) {
          alias = this.expectIdentifier();
        }
      }
      items.push({ expr, alias });
    } while (this.consumePunct(","));

    let from: TableRef | null = null;
    if (this.consumeWord("FROM")) {
      const name = this.expectIdentifier();
      let alias: string | null = null;
      if (this.consumeWord("AS")) {
        alias = this.expectIdentifier();
      } else {
        const tok = this.tokens[this.pos];
        const word = this.peekWord();
        if (tok?.type === "word" && word !== null && !KEYWORDS.has(word)) {
          alias = this.expectIdentifier();
        }
      }
      from = { name, alias };
    }

    let where: Expr | null = null;
    if (this.consumeWord("WHERE")) where = this.parseExpr();

    const orderBy: { expr: Expr; direction: "ASC" | "DESC" }[] = [];
    if (this.consumeWord("ORDER")) {
      this.expectWord("BY");
      do {
        const expr = this.parseExpr();
        let direction: "ASC" | "DESC" = "ASC";
        if (this.consumeWord("DESC")) direction = "DESC";
        else this.consumeWord("ASC");
        orderBy.push({ expr, direction });
      } while (this.consumePunct(","));
    }

    let limit: Expr | null = null;
    let offset: Expr | null = null;
    if (this.consumeWord("LIMIT")) limit = this.parseExpr();
    if (this.consumeWord("OFFSET")) offset = this.parseExpr();

    this.expectEnd();
    return { items, from, where, orderBy, limit, offset };
  }

  private parseUpdate(): Statement {
    this.expectWord("UPDATE");
    const table = this.expectIdentifier();
    this.expectWord("SET");
    const assignments = this.parseAssignments();
    let where: Expr | null = null;
    if (this.consumeWord("WHERE")) where = this.parseExpr();
    this.expectEnd();
    return { kind: "update", table, assignments, where };
  }

  private parseDelete(): Statement {
    this.expectWord("DELETE");
    this.expectWord("FROM");
    const table = this.expectIdentifier();
    let where: Expr | null = null;
    if (this.consumeWord("WHERE")) where = this.parseExpr();
    this.expectEnd();
    return { kind: "delete", table, where };
  }

  private parseDrop(): Statement {
    this.expectWord("DROP");
    this.expectWord("TABLE");
    let ifExists = false;
    if (this.consumeWord("IF")) {
      this.expectWord("EXISTS");
      ifExists = true;
    }
    const name = this.expectIdentifier();
    this.expectEnd();
    return { kind: "dropTable", name, ifExists };
  }

  private consumeIfNotExists(): boolean {
    if (this.consumeWord("IF")) {
      this.expectWord("NOT");
      this.expectWord("EXISTS");
      return true;
    }
    return false;
  }


  // --- expressions --------------------------------------------------------

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.consumeWord("OR")) {
      left = { kind: "binary", op: "OR", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.consumeWord("AND")) {
      left = { kind: "binary", op: "AND", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.consumeWord("NOT")) {
      return { kind: "unary", op: "NOT", operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (true) {
      const tok = this.tokens[this.pos];
      if (!tok) break;

      if (tok.type === "punct" && ["=", "<", ">", "<=", ">=", "<>", "!="].includes(tok.value)) {
        this.pos += 1;
        const op = tok.value === "<>" ? "!=" : tok.value;
        left = { kind: "binary", op, left, right: this.parseAdditive() };
        continue;
      }
      if (this.peekWord() === "IS") {
        this.pos += 1;
        const negated = this.consumeWord("NOT");
        this.expectWord("NULL");
        left = { kind: "isNull", operand: left, negated };
        continue;
      }
      if (this.peekWord() === "NOT" && this.peekWord(1) === "IN") {
        this.pos += 2;
        left = this.parseIn(left, true);
        continue;
      }
      if (this.peekWord() === "IN") {
        this.pos += 1;
        left = this.parseIn(left, false);
        continue;
      }
      if (this.peekWord() === "NOT" && this.peekWord(1) === "LIKE") {
        this.pos += 2;
        left = { kind: "like", operand: left, pattern: this.parseAdditive(), negated: true };
        continue;
      }
      if (this.peekWord() === "LIKE") {
        this.pos += 1;
        left = { kind: "like", operand: left, pattern: this.parseAdditive(), negated: false };
        continue;
      }
      break;
    }
    return left;
  }

  private parseIn(operand: Expr, negated: boolean): Expr {
    this.expectPunct("(");
    const values: Expr[] = [this.parseExpr()];
    while (this.consumePunct(",")) values.push(this.parseExpr());
    this.expectPunct(")");
    return { kind: "in", operand, values, negated };
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (true) {
      const tok = this.tokens[this.pos];
      if (tok?.type === "punct" && (tok.value === "+" || tok.value === "-")) {
        this.pos += 1;
        left = { kind: "binary", op: tok.value, left, right: this.parseMultiplicative() };
        continue;
      }
      break;
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (true) {
      const tok = this.tokens[this.pos];
      if (tok?.type === "punct" && (tok.value === "*" || tok.value === "/")) {
        this.pos += 1;
        left = { kind: "binary", op: tok.value, left, right: this.parseUnary() };
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): Expr {
    const tok = this.tokens[this.pos];
    if (tok?.type === "punct" && tok.value === "-") {
      this.pos += 1;
      return { kind: "unary", op: "-", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const tok = this.tokens[this.pos];
    if (!tok) throw new Error("Unexpected end of SQL");

    if (tok.type === "number") {
      this.pos += 1;
      return { kind: "literal", value: Number(tok.value) };
    }
    if (tok.type === "string") {
      this.pos += 1;
      return { kind: "literal", value: tok.value };
    }
    if (tok.type === "param") {
      this.pos += 1;
      const index = this.paramIndex;
      this.paramIndex += 1;
      return { kind: "param", index };
    }
    if (tok.type === "punct" && tok.value === "(") {
      this.pos += 1;
      const expr = this.parseExpr();
      this.expectPunct(")");
      return expr;
    }
    if (tok.type === "punct" && tok.value === "*") {
      this.pos += 1;
      return { kind: "star", qualifier: null };
    }
    if (tok.type === "word") {
      const upper = tok.value.toUpperCase();

      if (upper === "NULL") {
        this.pos += 1;
        return { kind: "literal", value: null };
      }
      if (upper === "CASE") {
        this.pos += 1;
        const branches: { when: Expr; then: Expr }[] = [];
        while (this.consumeWord("WHEN")) {
          const when = this.parseExpr();
          this.expectWord("THEN");
          branches.push({ when, then: this.parseExpr() });
        }
        let elseValue: Expr | null = null;
        if (this.consumeWord("ELSE")) elseValue = this.parseExpr();
        this.expectWord("END");
        return { kind: "case", branches, elseValue };
      }

      const next = this.tokens[this.pos + 1];
      if (next?.type === "punct" && next.value === "(") {
        const name = upper;
        this.pos += 2;
        const args: Expr[] = [];
        if (!this.consumePunct(")")) {
          args.push(this.parseExpr());
          while (this.consumePunct(",")) args.push(this.parseExpr());
          this.expectPunct(")");
        }
        return { kind: "call", name, args };
      }

      this.pos += 1;
      if (this.tokens[this.pos]?.type === "punct" && this.tokens[this.pos]!.value === ".") {
        this.pos += 1;
        const member = this.tokens[this.pos];
        if (member?.type === "punct" && member.value === "*") {
          this.pos += 1;
          return { kind: "star", qualifier: tok.value };
        }
        return { kind: "column", qualifier: tok.value, name: this.expectIdentifier() };
      }
      return { kind: "column", qualifier: null, name: tok.value };
    }

    throw new Error(`Unexpected token '${tok.value}' in expression`);
  }

  // --- token helpers ------------------------------------------------------

  private peekWord(offset = 0): string | null {
    const tok = this.tokens[this.pos + offset];
    if (!tok || tok.type !== "word") return null;
    return tok.value.toUpperCase();
  }

  private consumeWord(word: string): boolean {
    if (this.peekWord() === word) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expectWord(word: string): void {
    if (!this.consumeWord(word)) {
      throw new Error(`Expected '${word}' but found '${this.tokens[this.pos]?.value ?? "<end>"}'`);
    }
  }

  private consumePunct(value: string): boolean {
    const tok = this.tokens[this.pos];
    if (tok?.type === "punct" && tok.value === value) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expectPunct(value: string): void {
    if (!this.consumePunct(value)) {
      throw new Error(`Expected '${value}' but found '${this.tokens[this.pos]?.value ?? "<end>"}'`);
    }
  }

  private expectIdentifier(): string {
    const tok = this.tokens[this.pos];
    if (!tok) throw new Error("Expected an identifier but found end of SQL");
    if (tok.type === "word" || tok.type === "string") {
      this.pos += 1;
      return tok.value;
    }
    throw new Error(`Expected an identifier but found '${tok.value}'`);
  }

  private expectEnd(): void {
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected trailing token '${this.tokens[this.pos]!.value}'`);
    }
  }
}

function parse(sql: string): Statement {
  const tokens = tokenize(sql);
  if (tokens.length === 0) throw new Error("Empty SQL statement");
  return new Parser(tokens).parseStatement();
}


// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

interface Env {
  row: SQLRow;
  table: TableRef | null;
  excluded: SQLRow | null;
}

const EMPTY_ENV: Env = { row: {}, table: null, excluded: null };

function isTruthy(value: SQLValue): boolean {
  if (value === null) return false;
  if (typeof value === "number") return value !== 0;
  return value !== "";
}

function compareValues(a: SQLValue, b: SQLValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function likeMatches(value: SQLValue, pattern: SQLValue): boolean {
  if (value === null || pattern === null) return false;
  let regex = "^";
  for (const ch of String(pattern)) {
    if (ch === "%") regex += "[\\s\\S]*";
    else if (ch === "_") regex += "[\\s\\S]";
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  regex += "$";
  return new RegExp(regex, "i").test(String(value));
}

function resolveColumn(env: Env, qualifier: string | null, name: string): SQLValue {
  if (qualifier !== null && env.excluded !== null && qualifier.toLowerCase() === "excluded") {
    return env.excluded[name] ?? null;
  }
  if (env.table !== null && qualifier !== null) {
    const tableName = env.table.name.toLowerCase();
    const alias = env.table.alias?.toLowerCase() ?? null;
    if (qualifier.toLowerCase() !== tableName && qualifier.toLowerCase() !== alias) {
      throw new Error(`no such column: ${qualifier}.${name}`);
    }
  }
  return env.row[name] ?? null;
}

function callFunction(name: string, args: SQLValue[]): SQLValue {
  switch (name) {
    case "COUNT": {
      const value = args[0];
      if (args.length === 0) return 1;
      return value === null ? 0 : 1;
    }
    case "COALESCE": {
      for (const arg of args) if (arg !== null) return arg;
      return null;
    }
    case "LOWER":
      return args[0] === null || args[0] === undefined ? null : String(args[0]).toLowerCase();
    case "UPPER":
      return args[0] === null || args[0] === undefined ? null : String(args[0]).toUpperCase();
    case "ABS": {
      const value = args[0];
      return value === null || value === undefined ? null : Math.abs(Number(value));
    }
    case "MAX": {
      const present = args.filter((a): a is NonNullable<SQLValue> => a !== null);
      if (present.length === 0) return null;
      return present.reduce((acc, cur) => (compareValues(cur, acc) > 0 ? cur : acc));
    }
    case "MIN": {
      const present = args.filter((a): a is NonNullable<SQLValue> => a !== null);
      if (present.length === 0) return null;
      return present.reduce((acc, cur) => (compareValues(cur, acc) < 0 ? cur : acc));
    }
    default:
      throw new Error(`Unsupported SQL function: ${name}`);
  }
}

function evaluate(expr: Expr, env: Env, params: SQLValue[]): SQLValue {
  switch (expr.kind) {
    case "literal":
      return expr.value;

    case "param": {
      const value = params[expr.index];
      return value === undefined ? null : value;
    }

    case "column":
      return resolveColumn(env, expr.qualifier, expr.name);

    case "star":
      return null;

    case "unary": {
      if (expr.op === "NOT") return isTruthy(evaluate(expr.operand, env, params)) ? 0 : 1;
      const value = evaluate(expr.operand, env, params);
      return value === null ? null : -Number(value);
    }

    case "isNull": {
      const isNull = evaluate(expr.operand, env, params) === null;
      return (expr.negated ? !isNull : isNull) ? 1 : 0;
    }

    case "like": {
      const matches = likeMatches(
        evaluate(expr.operand, env, params),
        evaluate(expr.pattern, env, params),
      );
      return (expr.negated ? !matches : matches) ? 1 : 0;
    }

    case "in": {
      const needle = evaluate(expr.operand, env, params);
      if (needle === null) return null;
      const found = expr.values.some((v) => evaluate(v, env, params) === needle);
      return (expr.negated ? !found : found) ? 1 : 0;
    }

    case "case": {
      for (const branch of expr.branches) {
        if (isTruthy(evaluate(branch.when, env, params))) {
          return evaluate(branch.then, env, params);
        }
      }
      return expr.elseValue === null ? null : evaluate(expr.elseValue, env, params);
    }

    case "call": {
      const args = expr.args.map((arg) => evaluate(arg, env, params));
      return callFunction(expr.name, args);
    }

    case "binary": {
      const { op } = expr;

      if (op === "AND") {
        if (!isTruthy(evaluate(expr.left, env, params))) return 0;
        return isTruthy(evaluate(expr.right, env, params)) ? 1 : 0;
      }
      if (op === "OR") {
        if (isTruthy(evaluate(expr.left, env, params))) return 1;
        return isTruthy(evaluate(expr.right, env, params)) ? 1 : 0;
      }

      const left = evaluate(expr.left, env, params);
      const right = evaluate(expr.right, env, params);

      switch (op) {
        case "=":
          if (left === null || right === null) return null;
          return left === right ? 1 : 0;
        case "!=":
          if (left === null || right === null) return null;
          return left !== right ? 1 : 0;
        case "<":
        case "<=":
        case ">":
        case ">=": {
          if (left === null || right === null) return null;
          const cmp = compareValues(left, right);
          if (op === "<") return cmp < 0 ? 1 : 0;
          if (op === "<=") return cmp <= 0 ? 1 : 0;
          if (op === ">") return cmp > 0 ? 1 : 0;
          return cmp >= 0 ? 1 : 0;
        }
        case "+":
          if (left === null || right === null) return null;
          if (typeof left === "string" || typeof right === "string") return `${left}${right}`;
          return Number(left) + Number(right);
        case "-":
          if (left === null || right === null) return null;
          return Number(left) - Number(right);
        case "*":
          if (left === null || right === null) return null;
          return Number(left) * Number(right);
        case "/":
          if (left === null || right === null) return null;
          return Number(left) / Number(right);
        default:
          throw new Error(`Unsupported operator: ${op}`);
      }
    }
  }
}

/** Name of the output column when the SELECT item has no explicit alias. */
function columnName(expr: Expr, index: number): string {
  if (expr.kind === "column") return expr.name;
  return `column${index}`;
}

function isAggregate(expr: Expr): boolean {
  return expr.kind === "call" && expr.name === "COUNT";
}

/** Composite primary-key fingerprint used for ON CONFLICT detection. */
function primaryKeyOf(table: Table, row: SQLRow): string | null {
  if (table.primaryKey.length === 0) return null;
  return table.primaryKey.map((col) => String(row[col] ?? "\u0000null")).join("\u0001");
}

function runSelect(
  tables: Map<string, Table>,
  stmt: SelectStatement,
  params: SQLValue[],
): SQLRow[] {
  const table = stmt.from === null ? null : getTable(tables, stmt.from.name);
  const sourceRows: SQLRow[] = table === null ? [{}] : table.rows;

  const filtered: SQLRow[] = [];
  for (const row of sourceRows) {
    const env: Env = { row, table: stmt.from, excluded: null };
    if (stmt.where === null || isTruthy(evaluate(stmt.where, env, params))) {
      filtered.push(row);
    }
  }

  const hasAggregate = stmt.items.some((item) => isAggregate(item.expr));

  if (hasAggregate) {
    const out: SQLRow = {};
    stmt.items.forEach((item, index) => {
      const key = item.alias ?? columnName(item.expr, index);
      if (isAggregate(item.expr) && item.expr.kind === "call") {
        const arg = item.expr.args[0];
        if (arg === undefined || (arg.kind === "star")) {
          out[key] = filtered.length;
        } else {
          let count = 0;
          for (const row of filtered) {
            const value = evaluate(arg, { row, table: stmt.from, excluded: null }, params);
            if (value !== null) count += 1;
          }
          out[key] = count;
        }
        return;
      }
      const first = filtered[0];
      out[key] =
        first === undefined
          ? null
          : evaluate(item.expr, { row: first, table: stmt.from, excluded: null }, params);
    });
    return [out];
  }

  const projected: { row: SQLRow; source: SQLRow }[] = filtered.map((row) => {
    const env: Env = { row, table: stmt.from, excluded: null };
    const out: SQLRow = {};
    stmt.items.forEach((item, index) => {
      if (item.expr.kind === "star") {
        Object.assign(out, row);
        return;
      }
      out[item.alias ?? columnName(item.expr, index)] = evaluate(item.expr, env, params);
    });
    return { row: out, source: row };
  });

  const sorted = [...projected];
  if (stmt.orderBy.length > 0) {
    sorted.sort((a, b) => {
      for (const order of stmt.orderBy) {
        const left = evaluate(order.expr, { row: a.source, table: stmt.from, excluded: null }, params);
        const right = evaluate(order.expr, { row: b.source, table: stmt.from, excluded: null }, params);
        if (left === right) continue;
        if (left === null) return 1;
        if (right === null) return -1;
        const cmp = compareValues(left, right);
        return order.direction === "DESC" ? -cmp : cmp;
      }
      return 0;
    });
  }

  const offset = stmt.offset === null ? 0 : Math.max(0, Number(evaluate(stmt.offset, EMPTY_ENV, params)));
  const limit =
    stmt.limit === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(evaluate(stmt.limit, EMPTY_ENV, params)));

  return sorted.slice(offset, offset + limit).map((p) => p.row);
}

function execute(
  tables: Map<string, Table>,
  sql: string,
  params: SQLValue[],
): RunResult {
  const stmt = parse(sql);
  switch (stmt.kind) {
    case "createTable": {
      if (tables.has(stmt.name)) {
        if (stmt.ifNotExists) return { changes: 0 };
        throw new Error(`table ${stmt.name} already exists`);
      }
      const primaryKey =
        stmt.primaryKey.length > 0
          ? stmt.primaryKey
          : stmt.columns.filter((c) => c.primaryKey).map((c) => c.name);
      tables.set(stmt.name, { primaryKey, rows: [] });
      return { changes: 0 };
    }

    case "createIndex":
      return { changes: 0 };

    case "dropTable": {
      if (!tables.has(stmt.name)) {
        if (stmt.ifExists) return { changes: 0 };
        throw new Error(`no such table: ${stmt.name}`);
      }
      tables.delete(stmt.name);
      return { changes: 0 };
    }

    case "insert": {
      const table = getTable(tables, stmt.table);
      if (stmt.columns === null) {
        throw new Error("INSERT without an explicit column list is not supported");
      }

      const env: Env = { row: {}, table: null, excluded: null };
      const values = stmt.values.map((v) => evaluate(v, env, params));

      if (stmt.columns.length !== values.length) {
        throw new Error(
          `INSERT column count (${stmt.columns.length}) does not match value count (${values.length})`,
        );
      }

      const row: SQLRow = {};
      stmt.columns.forEach((col, index) => {
        row[col] = values[index] ?? null;
      });

      const key = primaryKeyOf(table, row);
      let conflictRow: SQLRow | null = null;
      if (key !== null) {
        conflictRow = table.rows.find((r) => primaryKeyOf(table, r) === key) ?? null;
      }

      if (conflictRow !== null) {
        if (stmt.onConflict === null) {
          throw new Error(`UNIQUE constraint failed: ${stmt.table}.${table.primaryKey.join(", ")}`);
        }
        if (stmt.onConflict.action === "nothing") return { changes: 0 };
        const conflictEnv: Env = { row: conflictRow, table: null, excluded: row };
        for (const assignment of stmt.onConflict.assignments) {
          conflictRow[assignment.column] = evaluate(assignment.value, conflictEnv, params);
        }
        return { changes: 1 };
      }

      table.rows.push(row);
      return { changes: 1 };
    }

    case "update": {
      const table = getTable(tables, stmt.table);
      let changes = 0;
      for (const row of table.rows) {
        const env: Env = { row, table: null, excluded: null };
        if (stmt.where !== null && !isTruthy(evaluate(stmt.where, env, params))) continue;
        for (const assignment of stmt.assignments) {
          row[assignment.column] = evaluate(assignment.value, env, params);
        }
        changes += 1;
      }
      return { changes };
    }

    case "delete": {
      const table = getTable(tables, stmt.table);
      const before = table.rows.length;
      table.rows = table.rows.filter((row) => {
        if (stmt.where === null) return false;
        const env: Env = { row, table: null, excluded: null };
        return !isTruthy(evaluate(stmt.where, env, params));
      });
      return { changes: before - table.rows.length };
    }

    case "select":
      throw new Error("SELECT must be executed via all()/get()");

    case "tx":
      // Transaction control is handled by MemoryDatabaseDriver.transaction().
      return { changes: 0 };
  }
}

