/** 再現できる乱数(mulberry32)。golden のシナリオを毎回同じ内容で作るために使う。 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 0 以上 1 未満 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** 0 以上 max 未満の整数 */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** min 以上 max 以下の整数 */
  between(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) throw new Error("空の配列からは選べません");
    return item;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = this.int(index + 1);
      const current = copy[index] as T;
      copy[index] = copy[other] as T;
      copy[other] = current;
    }
    return copy;
  }
}
