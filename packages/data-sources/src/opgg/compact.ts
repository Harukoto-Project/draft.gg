/**
 * OP.GG MCP のコンパクト形式を、JSON 相当のオブジェクトに復号する。
 *
 * 応答は JSON ではなく、「クラス宣言」と「本体」の2部構成になっている。
 *
 *   class Foo: data
 *   class Data: summary,damage_type
 *   class Summary: id,name
 *
 *   Foo(Data(Summary(517,"Sylas"),"AP"))
 *
 * `class 名前: a,b,c` は、`名前(…)` の位置引数がどのフィールドに対応するかを宣言する。
 * 復号すると `{ data: { summary: { id: 517, name: "Sylas" }, damage_type: "AP" } }` になる。
 * 値は、数値・文字列(JSON と同じエスケープ)・配列 `[…]`・null/true/false・クラス呼び出し。
 */

const CLASS_DECLARATION = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/y;

export function decodeCompact(text: string): unknown {
  const lines = text.split(/\r?\n/);
  const classes = new Map<string, string[]>();

  let bodyStart = -1;
  for (const [index, line] of lines.entries()) {
    const declaration = CLASS_DECLARATION.exec(line);
    if (declaration) {
      const name = declaration[1]!;
      const fields = (declaration[2] ?? "")
        .split(",")
        .map((field) => field.trim())
        .filter((field) => field !== "");
      const existing = classes.get(name);
      // 同じ名前を別の形で再宣言されると、値の対応が壊れるため読まない
      if (existing && existing.join(",") !== fields.join(",")) {
        throw new Error(`クラス ${name} の宣言が食い違っています`);
      }
      classes.set(name, fields);
      continue;
    }
    if (line.trim() === "") continue;
    bodyStart = index;
    break;
  }
  if (bodyStart < 0 || classes.size === 0) {
    throw new Error("OP.GG の応答がコンパクト形式として読めません");
  }

  return new Reader(lines.slice(bodyStart).join("\n"), classes).readAll();
}

class Reader {
  private position = 0;

  constructor(
    private readonly source: string,
    private readonly classes: Map<string, string[]>,
  ) {}

  readAll(): unknown {
    const value = this.readValue();
    this.skipSpace();
    if (this.position < this.source.length) throw this.error("本体の末尾に余分な文字があります");
    return value;
  }

  private readValue(): unknown {
    this.skipSpace();
    const char = this.source[this.position];
    if (char === undefined) throw this.error("値が途中で終わっています");
    if (char === "[") return this.readList();
    if (char === '"') return this.readString();
    if (char === "-" || (char >= "0" && char <= "9")) return this.readNumber();
    return this.readNamed();
  }

  private readList(): unknown[] {
    this.position += 1;
    const items: unknown[] = [];
    this.skipSpace();
    if (this.source[this.position] === "]") {
      this.position += 1;
      return items;
    }
    for (;;) {
      items.push(this.readValue());
      this.skipSpace();
      const next = this.source[this.position];
      this.position += 1;
      if (next === "]") return items;
      if (next !== ",") throw this.error("配列の区切りが不正です");
    }
  }

  private readString(): string {
    const start = this.position;
    this.position += 1;
    while (this.position < this.source.length) {
      const char = this.source[this.position];
      if (char === "\\") {
        this.position += 2;
        continue;
      }
      this.position += 1;
      if (char === '"') {
        try {
          return JSON.parse(this.source.slice(start, this.position)) as string;
        } catch {
          throw this.error("文字列が不正です");
        }
      }
    }
    throw this.error("文字列が閉じていません");
  }

  private readNumber(): number {
    NUMBER.lastIndex = this.position;
    const match = NUMBER.exec(this.source);
    if (!match) throw this.error("数値が不正です");
    this.position = NUMBER.lastIndex;
    return Number(match[0]);
  }

  /** null / true / false、またはクラス呼び出し `Name(...)` */
  private readNamed(): unknown {
    IDENTIFIER.lastIndex = this.position;
    const match = IDENTIFIER.exec(this.source);
    if (!match) throw this.error("値を読めません");
    const name = match[0];
    this.position = IDENTIFIER.lastIndex;

    if (this.source[this.position] !== "(") {
      if (name === "null") return null;
      if (name === "true") return true;
      if (name === "false") return false;
      throw this.error(`未知の値です: ${name}`);
    }

    this.position += 1;
    const args: unknown[] = [];
    this.skipSpace();
    if (this.source[this.position] === ")") {
      this.position += 1;
    } else {
      for (;;) {
        args.push(this.readValue());
        this.skipSpace();
        const next = this.source[this.position];
        this.position += 1;
        if (next === ")") break;
        if (next !== ",") throw this.error("引数の区切りが不正です");
      }
    }
    return this.build(name, args);
  }

  private build(name: string, args: unknown[]): Record<string, unknown> {
    const fields = this.classes.get(name);
    if (!fields) throw this.error(`宣言のないクラスです: ${name}`);
    if (args.length > fields.length) {
      throw this.error(`クラス ${name} の引数が宣言(${fields.length})より多いです`);
    }
    const object: Record<string, unknown> = {};
    for (const [index, field] of fields.entries()) {
      if (index < args.length) object[field] = args[index];
    }
    return object;
  }

  private skipSpace(): void {
    while (this.position < this.source.length && /\s/.test(this.source[this.position]!)) {
      this.position += 1;
    }
  }

  private error(message: string): Error {
    return new Error(`OP.GG の応答を読めません(位置 ${this.position}): ${message}`);
  }
}
