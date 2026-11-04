/**
 * Non-Colored Coroutines & Generator Iterators
 * Eliminates function coloring (red/blue async functions) and GIL contention
 * by executing discrete steps via generator yield semantics.
 */

export interface CoroutineYield<T = unknown> {
  value: T;
  done: boolean;
}

export class CoroutineRunner {
  /**
   * Run a generator step-by-step synchronously without function coloring
   */
  public static step<T>(generator: Generator<T, T, unknown>): CoroutineYield<T> {
    const next = generator.next();
    return {
      value: next.value,
      done: Boolean(next.done)
    };
  }

  /**
   * Run all steps of a generator and return all yielded outputs
   */
  public static runAll<T>(generator: Generator<T, T, unknown>): T[] {
    const results: T[] = [];
    while (true) {
      const step = generator.next();
      results.push(step.value);
      if (step.done) {
        break;
      }
    }
    return results;
  }

  /**
   * Pipe generators together without intermediate allocations
   */
  public static *pipe<A, B>(
    source: Generator<A, void, unknown>,
    transform: (item: A) => B
  ): Generator<B, void, unknown> {
    for (const item of source) {
      yield transform(item);
    }
  }
}
