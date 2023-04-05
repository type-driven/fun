import type { Kind, Out } from "./kind.ts";
import type { Alt } from "./alt.ts";
import type { Bifunctor } from "./bifunctor.ts";
import type { Either } from "./either.ts";
import type { Monad } from "./monad.ts";
import type { Async } from "./async.ts";
import type { AsyncEither } from "./async_either.ts";

import * as A from "./async.ts";
import * as AE from "./async_either.ts";
import * as E from "./either.ts";
import * as F from "./fn.ts";
import { Fn, pipe } from "./fn.ts";

/**
 * The FnAsyncEither type can best be thought of as an asynchronous function that
 * takes dependencies (d: D) and returns an AsyncEither.
 * (...d: D[]) => AsyncEither<L, R>
 * Builds on AsyncEither and enables injecting an environment into an async computation
 *
 * @since 2.0.0
 */
export type FnAsyncEither<D, L, R> =
  | (() => AsyncEither<L, R>)
  | ((...d: D[]) => AsyncEither<L, R>);

export interface URI extends Kind {
  readonly kind: FnAsyncEither<Out<this, 2>, Out<this, 1>, Out<this, 0>>;
}

/**
 * Constructs a FnAsyncEither from a value and wraps it in an inner *Left*.
 * Traditionally signaling a failure
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 *
 * const computation = FAE.left<number, number>(1);
 * const result = await computation()();
 *
 * assertEquals(result, E.left(1));
 * ```
 *
 * @since 2.0.0
 */
export function left<B = never, A = never, D = never>(
  left: B,
): FnAsyncEither<D, B, A> {
  return F.of(AE.left(left));
}

/**
 * Constructs an FnAsyncEither from a value and wraps it in an inner *Right*.
 * Traditionally signaling a successful computation
 * 
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 *
 * const computation = FAE.right<number, number>(1);
 * const result = await computation()();
 *
 * assertEquals(result, E.right(1));
 * ```
 *
 * @since 2.0.0
 */
export function right<A = never, B = never, D = never>(
  right: A,
): FnAsyncEither<D, B, A> {
  return F.of(AE.right(right));
}

/**
 * Wraps a Async of A in a try-catch block which upon failure returns B instead.
 * Upon success returns a *Right<A>* and *Left<B>* for a failure.
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 *
 * const _fetch = FAE.tryCatch(
 *   fetch,
 *   (error, args) => ({ message: "Fetch Error", error, args })
 * );
 *
 * const t1 = await _fetch("blah")();
 * assertEquals(t1.tag, "Left");
 *
 * const t2 = await _fetch("https://deno.land/")();
 * assertEquals(t2.tag, "Right");
 * ```
 *
 * @since 2.0.0
 */
export function tryCatch<D, A, B>(
  fasr: (d: D) => A | PromiseLike<A>,
  onThrow: (e: unknown, as: [D]) => B,
): FnAsyncEither<D, B, A> {
  return (d: D) => AE.tryCatch(fasr, onThrow)(d);
}

/**
 * Lift an always succeeding computation (Fn) into an FnAsyncEither
 */
export function fromFn<D, A, B>(fa: Fn<D, A>): FnAsyncEither<D, B, A> {
  return (d: D) => of(fa(d))(d);
}

/**
 * Lift an always succeeding async computation (Async) into a FnAsyncEither
 */
export function fromAsync<D, A, B = never>(
  ta: Async<A>,
): FnAsyncEither<D, B, A> {
  return F.of(() => ta().then(E.right));
}

/**
 * Lifts an Either<B,A> into a FnAsyncEither<D,B,A>
 */
export function fromEither<D, A, B>(ta: Either<B, A>): FnAsyncEither<D, B, A> {
  return F.pipe(ta, A.of, F.of);
}

/**
 * Lifts an AsyncEither<B, A> into an FnAsyncEither<D,B,A>
 */
export function fromAsyncEither<D, A, B>(
  ta: AE.AsyncEither<B, A>,
): FnAsyncEither<D, B, A> {
  return F.of(ta);
}

/**
 * Pointed constructor of(A) => FnAsyncEither<D,B,A>
 */
export function of<D, A, B = never>(a: A): FnAsyncEither<D, B, A> {
  return right(a);
}

/**
 * Pointed constructor throwError(B) => FnAsyncEither<D,B,never>
 */
export function throwError<D = never, A = never, B = never>(
  b: B,
): FnAsyncEither<D, B, A> {
  return left(b);
}

/**
 * A dual map function that maps over both *Left* and *Right* side of
 * an FnAsyncEither.
 */
export function bimap<A, B, I, J>(
  fbj: (b: B) => J,
  fai: (a: A) => I,
): <D>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, J, I> {
  return (ta) => pipe(ta, F.map(A.map(E.bimap(fbj, fai))));
}

/**
 * Map a function over the *Right* side of an FnAsyncEither
 */
export function map<A, I>(
  fai: (a: A) => I,
): <B, D>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, B, I> {
  return (ta) => pipe(ta, F.map(AE.map(fai)));
}

/**
 * Map a function over the *Left* side of an FnAsyncEither
 */
export function mapLeft<B, J>(
  fbj: (b: B) => J,
): <A, D>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, J, A> {
  return (ta) => pipe(ta, F.map(A.map(E.mapLeft(fbj))));
}

/**
 * Apply an argument to a function under the *Right* side.
 */
export function apParallel<A, B, D>(
  ua: FnAsyncEither<D, B, A>,
): <I, J, K>(
  ufai: FnAsyncEither<K, J, (a: A) => I>,
) => FnAsyncEither<K | D, B | J, I> {
  return <I, J, K>(ufai: FnAsyncEither<K, J, (a: A) => I>) => (d: K | D) => AE.apParallel(ua(d as D))(ufai(d as K));
}

/**
 * Sequentially apply arguments
 */
export function apSequential<A, B, D>(
  ua: FnAsyncEither<D, B, A>,
): <I, J, K>(
  ufai: FnAsyncEither<K, J, (a: A) => I>,
) => FnAsyncEither<K | D, B | J, I> {
  return <I, J, K>(ufai: FnAsyncEither<K, J, (a: A) => I>) => (d: K | D) => AE.apSequential(ua(d as D))(ufai(d as K));
}

/**
 * Chain AsyncEither based computations together in a pipeline
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 * import { pipe } from "./fn.ts";
 *
 * const ta = pipe(
 *   FAE.of(1),
 *   FAE.chain(n => FAE.of(n*2)),
 *   FAE.chain(n => FAE.of(n**2))
 * )
 *
 * assertEquals(await ta()(), E.right(4))
 * ```
 */
export function chain<A, I, J, K>(
  fati: (a: A) => FnAsyncEither<K, J, I>,
): <B, D>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D | K, B | J, I> {
  return <B, D>(ta: FnAsyncEither<D, B, A>) => (d: K | D) => async () => {
    const ea = await ta(d as D)();
    if (E.isLeft(ea)) {
      return ea;
    } else {
      return await fati(ea.right)(d as K)();
    }
  };
}

export function chainFirst<D, A, I, J>(
  fati: (a: A) => FnAsyncEither<D, J, I>,
): <B>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, B | J, A> {
  return (ta) => (d: D) => async () => {
    const ea = await ta(d)();
    if (E.isLeft(ea)) {
      return ea;
    } else {
      const ei = await fati(ea.right)(d)();
      return E.isLeft(ei) ? ei : ea;
    }
  };
}

/**
 * Chain FnAsyncEither based failures, *Left* sides, useful for recovering
 * from error conditions.
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 * import { pipe } from "./fn.ts";
 *
 * const ta = pipe(
 *   FAE.throwError(1),
 *   FAE.chainLeft(n => FAE.of(n*2)),
 *   FAE.chain(n => FAE.of(n**2))
 * )
 *
 * assertEquals(await ta(), E.right(4))
 * ```
 */
export function chainLeft<D, B, J, I>(
  fbtj: (b: B) => FnAsyncEither<D, J, I>,
): <A>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, J, A | I> {
  return (ta) => (d: D) => async () => {
    const ea = await ta(d)();
    return E.isLeft(ea) ? fbtj(ea.left)(d)() : ea;
  };
}

/**
 * Flatten an FnAsyncEither wrapped in an FnAsyncEither
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 * import { pipe } from "./fn.ts";
 *
 * const ta = pipe(
 *   TE.of(1),
 *   TE.map(n => TE.of(n*2)),
 *   TE.join,
 *   TE.chain(n => TE.of(n**2))
 * )
 *
 * assertEquals(await ta(), E.right(4))
 * ```
 */
export function join<A, B = never, C = never, D = unknown, E = unknown, J = never, K = never>(
  tta: FnAsyncEither<K, J, FnAsyncEither<C, B, A>>,
): FnAsyncEither<C | K, B | J, A> {
  return pipe(tta, chain(F.identity));
}

/**
 * Provide an alternative for a failed computation.
 * Useful for implementing defaults.
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as FAE from "./fn_async_either.ts";
 * import * as E from "./either.ts";
 * import { pipe } from "./fn.ts";
 *
 * const ta = pipe(
 *   TE.throwError(1),
 *   TE.alt(TE.of(2)),
 * )
 *
 * assertEquals(await ta(), E.right(2))
 * ```
 */
export function alt<D, I, J>(
  ti: FnAsyncEither<D, J, I>,
): <A, B>(ta: FnAsyncEither<D, B, A>) => FnAsyncEither<D, B | J, A | I> {
  return (ta) => (d: D) => async () => {
    const ea = await ta(d)();
    return E.isLeft(ea) ? ti(d)() : ea;
  };
}

/**
 * Fold away the inner Either from the `FnAsyncEither` leaving us with the
 * result of our computation in the form of a `Async`
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
 * import * as TE from "./async_either.ts";
 * import * as T from "./async.ts";
 * import { flow, identity } from "./fn.ts";
 *
 * const hello = flow(
 *   TE.match(() => "World", identity),
 *   T.map((name) => `Hello ${name}!`),
 * );
 *
 * assertEquals(await hello(TE.right("Functional!"))(), "Hello Functional!!");
 * assertEquals(await hello(TE.left(Error))(), "Hello World!");
 * ```
 */
export function match<D, L, R, B>(
  onLeft: (left: L) => B,
  onRight: (right: R) => B,
): (ta: FnAsyncEither<D, L, R>) => (d: D) => Promise<B> {
  return (ta) => (d: D) => ta(d)().then(E.match<L, R, B>(onLeft, onRight));
}

export function id<A, B = never>(): FnAsyncEither<A, B, A> {
  return fromFn(F.identity);
}
export function ask<A, B = never>() {
  return id<A, B>();
}
export const asks = <D, A>(f: (d: D) => A) => (d: D) => right(f(d));
export const local = <D, A>(f: (d: D) => D) => (ta: FnAsyncEither<D, never, A>) => (d: D) => ta(f(d));
export const askFn = <D, A>(ta: FnAsyncEither<D, never, A>) => (d: D) => ta(d);

// This leaks async ops so we cut it for now.
//export const timeout = <E, A>(ms: number, onTimeout: () => E) =>
//  (ta: AsyncEither<E, A>): AsyncEither<E, A> =>
//    () => Promise.race([ta(), wait(ms).then(flow(onTimeout, E.left))]);

export const BifunctorAsyncEither: Bifunctor<URI> = { bimap, mapLeft };

export const MonadAsyncEitherParallel: Monad<URI> = {
  of,
  ap: apParallel,
  map,
  join,
  chain,
};

export const AltAsyncEither: Alt<URI> = { alt, map };

export const MonadAsyncEitherSequential: Monad<URI> = {
  of,
  ap: apSequential,
  map,
  join: join,
  chain: chain,
};
