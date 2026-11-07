export interface IngestArgs {
  /** ジョブ名またはグループ名。空ならすべて */
  targets: string[];
  /** `--csv` で指定した、Oracle's Elixir のローカル CSV */
  csvPath?: string;
}

/**
 * `pnpm ingest` の引数を読む。
 * 例: `pro --csv ./data/2026.csv`、`ddragon opgg-meta`、`--csv=./data/2026.csv pro-oracles`
 */
export function parseIngestArgs(argv: string[]): IngestArgs {
  const targets: string[] = [];
  let csvPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--") continue;
    if (arg === "--csv" || arg.startsWith("--csv=")) {
      const value = arg === "--csv" ? argv[++i] : arg.slice("--csv=".length);
      if (!value || value.startsWith("--")) {
        throw new Error("--csv にはファイルのパスを指定してください(例: --csv ./data/2026.csv)");
      }
      csvPath = value;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`不明なオプションです: ${arg}(指定できるのは --csv <パス>)`);
    }
    targets.push(arg);
  }

  return { targets, csvPath };
}
