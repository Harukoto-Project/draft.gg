/** Data Dragon のバージョン("16.21.1")からパッチ番号("16.21")を取り出す。 */
export function patchOf(ddragonVersion: string): string {
  const match = /^(\d+)\.(\d+)(?:\.\d+)*$/.exec(ddragonVersion);
  if (!match) {
    throw new Error(`Data Dragon のバージョン形式が不正です: ${ddragonVersion}`);
  }
  return `${match[1]}.${match[2]}`;
}
