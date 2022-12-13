/**
 * An Optic is at heart two functions, view and modify. The
 * view function is used to view some structure A that is
 * contained in some structure S. The value that the view
 * function tries to return is called its Focus, thus the
 * name Optic. The Focus of the view function can be the
 * value at a struct property, in an Option, or it can
 * even reference all the values in a homogenous array.
 * Thus the view function will return either 0, 1, or
 * many of its Focus. Optics in this library are built
 * to be composable. Let's look at some examples.
 *
 * @example
 * ```ts
 * import * as O from "./optics.ts";
 * import { pipe } from "./fn.ts";
 *
 * // First lets create some data we are working with
 * type Person = { name: string; age: number; children?: People };
 * type People = readonly Person[];
 *
 * function person(name: string, age: number, children?: People): Person {
 *   return { name, age, children };
 * }
 *
 * const rufus = person("Rufus", 0.8);
 * const clementine = person("Clementine", 0.5);
 * const brandon = person("Brandon", 37, [rufus, clementine]);
 * const jackie = person("Jackie", 57, [brandon]);
 *
 * // This Optic goes from Person to Person
 * const children = pipe(
 *   O.id<Person>(),
 *   O.prop("children"),
 *   O.nilable,
 *   O.array,
 * );
 *
 * // We can extend children with itself to get grandchildren
 * // This Optic also goes from Person to Person (two levels)
 * const grandchildren = pipe(
 *   children,
 *   O.compose(children),
 * );
 *
 * // We can prepare an Optic from Person to name
 * const names = O.prop<Person, "name">("name");
 *
 * // These return arrays of names of children and grandchildren
 * const jackiesChildren = pipe(children, names, O.view(jackie));
 * const jackiesGrandchildren = pipe(grandchildren, names, O.view(jackie));
 * ```
 *
 * In the above example we have a potentially recursive data structure with
 * optional fields, arrays, and structures. We start by building an Optic
 * from a Person to each of their children. Then we compose this
 * with itself to get grandchildren. And lastly we build a getter to get
 * the name of a Person. Combining these getteres we are able to quickly
 * list out the names of People for any generation under a Person.
 *
 * Optics can also be used to modify the data that they are focused on.
 * They do so immutably and as easily as they can view data. Another
 * example.
 *
 * ```ts
 * import * as O from "./optics.ts";
 * import { pipe } from "./fn.ts";
 *
 * type Todo = { text: string; completed: boolean };
 * type Todos = readonly Todo[];
 *
 * const todo = (text: string, completed: boolean = false): Todo => ({
 *   text,
 *   completed,
 * });
 *
 * const myTodos: Todos = [
 *   todo("Write some good examples for Optics"),
 *   todo("Make sure the examples actually work"),
 *   todo("Make some coffee"),
 *   todo("Drink some coffee"),
 * ];
 *
 * // Focus on the completed field of the todos
 * const completed = pipe(O.id<Todos>(), O.array, O.prop("completed"));
 * const markAllAsCompleted = completed.modify(() => true);
 *
 * // This is a new Todos object with new Todo objects all with completed
 * // set to true
 * const newTodos = markAllAsCompleted(myTodos);
 * ```
 *
 * @module Optics
 *
 * @since 2.0.0
 */
import type { $, In, Kind, Out } from "./kind.ts";
import type { ReadonlyRecord } from "./record.ts";
import type { Tree } from "./tree.ts";
import type { Either } from "./either.ts";
import type { Iso } from "./iso.ts";
import type { Monad } from "./monad.ts";
import type { Monoid } from "./monoid.ts";
import type { Option } from "./option.ts";
import type { Pair } from "./pair.ts";
import type { Predicate } from "./predicate.ts";
import type { Refinement } from "./refinement.ts";
import type { Eq } from "./eq.ts";
import type { Traversable } from "./traversable.ts";

import * as I from "./identity.ts";
import * as O from "./option.ts";
import * as A from "./array.ts";
import * as R from "./record.ts";
import * as E from "./either.ts";
import * as M from "./map.ts";
import * as P from "./pair.ts";
import { TraversableSet } from "./set.ts";
import { TraversableTree } from "./tree.ts";
import { isNotNil } from "./nilable.ts";
import { concatAll as getConcatAll } from "./monoid.ts";
import { dimap, flow, identity, over, pipe } from "./fn.ts";

/**
 * Following are the runtime tags associated
 * with various forms of Optics.
 */

const GetTag = "Getter" as const;
type GetTag = typeof GetTag;

const AffineTag = "Affine" as const;
type AffineTag = typeof AffineTag;

const FoldTag = "Fold" as const;
type FoldTag = typeof FoldTag;

type Tag = GetTag | AffineTag | FoldTag;

/**
 * Type level mapping from Tag to URI. Since an
 * Optic get function is a Kliesli Arrow a => mb, we
 * associate the Optic Tags as follows:
 *
 * GetTag => Identity
 * AffineTag => Option
 * FoldTag => Array
 */
type ToURI<T extends Tag> = T extends GetTag ? I.URI
  : T extends AffineTag ? O.URI
  : T extends FoldTag ? A.URI
  : never;

export type Viewer<T extends Tag, S, A> = {
  readonly tag: T;
  readonly view: (s: S) => $<ToURI<T>, [A, never, never]>;
};

export interface KindViewer extends Kind {
  readonly kind: Viewer<Tag, In<this, 0>, Out<this, 0>>;
}

export function viewer<T extends Tag, S, A>(
  tag: T,
  view: (s: S) => $<ToURI<T>, [A, never, never]>,
): Viewer<T, S, A> {
  return { tag, view };
}

export type Modifier<S, A> = {
  readonly modify: (modifyFn: (a: A) => A) => (s: S) => S;
};

/**
 * Our new Optic definition. Instead of get and set we use get and modify as
 * set can be derived from modify(() => value). This drastically simplifies
 * implementation.
 */
export type Optic<T extends Tag, S, A> = Viewer<T, S, A> & Modifier<S, A>;

/**
 * We recover the Getter type from the generic Optic
 */
export type Getter<S, A> = Optic<GetTag, S, A>;

/**
 * We recover the Affine type from the generic Optic
 */
export type Affine<S, A> = Optic<AffineTag, S, A>;

/**
 * We recover the Fold type from the generic Optic
 */
export type Fold<S, A> = Optic<FoldTag, S, A>;

export function optic<U extends Tag, S, A>(
  tag: U,
  view: (s: S) => $<ToURI<U>, [A, never, never]>,
  modify: (modifyFn: (a: A) => A) => (s: S) => S,
): Optic<U, S, A> {
  return { tag, view, modify };
}

/**
 * Construct a Getter from get and modify functions.
 */
export function getter<S, A>(
  view: (s: S) => A,
  modify: (modifyFn: (a: A) => A) => (s: S) => S,
): Getter<S, A> {
  return optic(GetTag, view, modify);
}

/**
 * Construct a Affine from get and modify functions.
 */
export function affine<S, A>(
  view: (s: S) => Option<A>,
  modify: (modifyFn: (a: A) => A) => (s: S) => S,
): Affine<S, A> {
  return optic(AffineTag, view, modify);
}

/**
 * Construct a Fold from get and modify functions.
 */
export function fold<S, A>(
  view: (s: S) => ReadonlyArray<A>,
  modify: (modifyFn: (a: A) => A) => (s: S) => S,
): Fold<S, A> {
  return optic(FoldTag, view, modify);
}

/**
 * Align will give us the "loosest" of two tags. This is used to
 * determine the abstraction level that an Optic operatates at. The
 * most contstrained is Identity while the least constrained is Array.
 * The typescript version of the source optics Getters are as follows:
 *
 * ```ts
 * import type { Identity } from "./identity.ts";
 * import type { Option } from "./option.ts";
 *
 * type Getter<S, A>      = { get: (s: S) => Identity<A> };
 * type Affine<S, A>     = { get: (s: S) =>   Option<A> };
 * type Fold<S, A> = { get: (s: S) =>    Array<A> };
 * ```
 *
 * Here we can see that Getter is constrained to get exactly one A,
 * Affine is constrained to get zero or one A, and Fold is
 * constrained to get zero, one, or many As. Because of this,
 * Getter can always be lifted to a Affine and Affine can always be
 * lifted to Fold. All Optics share the same modify function
 * over S and A.
 *
 * Thus Align is like GT where Array > Option > Identity.
 */
type Align<U extends Tag, V extends Tag> = U extends FoldTag ? FoldTag
  : V extends FoldTag ? FoldTag
  : U extends AffineTag ? AffineTag
  : V extends AffineTag ? AffineTag
  : GetTag;

/**
 * The runtime level GTE for Align
 */
function align<A extends Tag, B extends Tag>(
  a: A,
  b: B,
): Align<A, B> {
  return ((a === FoldTag || b === FoldTag)
    ? FoldTag
    : (a === AffineTag || b === AffineTag)
    ? AffineTag
    : GetTag) as Align<A, B>;
}

/**
 * Create a view function from a Viewer<U, S, A> and
 * a tag V. In the case where U and V match this is
 * a noop, returning the view function from the input
 * Viewer. Otherwise this uses hand coded Natural
 * Transformations for:
 *
 * Identity<A> -> Option<A>
 * Identity<A> -> ReadonlyArray<A>
 * Option<A> -> ReadonlyArray<A>
 *
 * This cast is unable to downcast from Array or Option and
 * will throw a runtime error if that is attempted.
 * Because of this, the cast function is not exported and
 * is only used in compose and ap, where two tags are
 * aligned prior to casting.
 */
function cast<U extends Tag, V extends Tag, S, A>(
  viewer: Viewer<U, S, A>,
  tag: V,
): Viewer<V, S, A>["view"] {
  type Out = Viewer<V, S, A>["view"];
  // Covers Getter => Getter, Affine => Affine, Fold => Fold
  if (viewer.tag === tag as GetTag) {
    return viewer.view as Out;
    // Affine => Fold
  } else if (tag === FoldTag && viewer.tag === AffineTag) {
    return (s: S) => {
      const ua = viewer.view(s) as Option<A>;
      return (O.isNone(ua) ? [] : [ua.value]) as ReturnType<Out>;
    };
    // Getter => Fold
  } else if (tag === FoldTag && viewer.tag === GetTag) {
    return (s: S) => [viewer.view(s)] as ReturnType<Out>;
    // Getter => Affine
  } else if (tag === AffineTag && viewer.tag == GetTag) {
    return (s) => O.of(viewer.view(s)) as ReturnType<Out>;
  }
  // Non-valid casts will throw an error at runtime.
  // This is not reachable with the combinators in this lib.
  throw new Error(`Attempted to cast ${viewer.tag} to ${tag}`);
}

function getMonad<T extends Tag>(tag: T): Monad<ToURI<T>> {
  return (tag === FoldTag
    ? A.MonadArray
    : tag === AffineTag
    ? O.MonadOption
    : I.MonadIdentity) as unknown as Monad<ToURI<T>>;
}

// deno-lint-ignore no-explicit-any
const _identity: Getter<any, any> = getter(identity, identity);

/**
 * The starting place for most Optics. Create an Optic over the
 * identity function.
 */
export function id<A>(): Getter<A, A> {
  return _identity;
}

/**
 * Compose two Optics by:
 *
 * 1. Finding the alignment of them, which is Max<first, second> where
 *    Fold > Affine > Get
 * 2. Cast both optics to the alignment tag, one cast will always be
 *    a noop.
 * 3. Construct a new optic by chaining the view functions first to
 *    second and composing the modify functions second to first.
 */
export function compose<V extends Tag, A, I>(second: Optic<V, A, I>) {
  return <U extends Tag, S>(
    first: Optic<U, S, A>,
  ): Optic<Align<U, V>, S, I> => {
    const tag = align(first.tag, second.tag);
    const _chain = getMonad(tag).chain;
    const _first = cast(first, tag);
    const _second = cast(second, tag);
    return optic(
      tag,
      flow(_first, _chain(_second)),
      flow(second.modify, first.modify),
    );
  };
}

export function of<A, S = unknown>(a: A): Viewer<GetTag, S, A> {
  return viewer(GetTag, (_: S) => a);
}

export function map<A, I>(
  fai: (a: A) => I,
): <T extends Tag, S>(first: Viewer<T, S, A>) => Viewer<T, S, I> {
  return ({ tag, view }) => {
    const _map = getMonad(tag).map;
    return viewer(tag, flow(view, _map(fai)));
  };
}

export function ap<V extends Tag, S, A>(
  second: Viewer<V, S, A>,
): <U extends Tag, I>(
  first: Viewer<U, S, (a: A) => I>,
) => Viewer<Align<U, V>, S, I> {
  return (first) => {
    const tag = align(first.tag, second.tag);
    const _ap = getMonad(tag).ap;
    const _first = cast(first, tag);
    const _second = cast(second, tag);
    return viewer(tag, (s) => pipe(_first(s), _ap(_second(s))));
  };
}

/**
 * Invariant map over the focus of an existing Optic.
 */
export function imap<A, I>(
  fai: (a: A) => I,
  fia: (i: I) => A,
): <U extends Tag, S>(
  first: Optic<U, S, A>,
) => Optic<Align<U, GetTag>, S, I> {
  return compose(getter(fai, dimap(fai, fia)));
}

/**
 * Construct a Affine from a Predicate or a Refinement.
 */
export function fromPredicate<S, A extends S>(
  refinement: Refinement<S, A>,
): Affine<S, A>;
export function fromPredicate<A>(predicate: Predicate<A>): Affine<A, A>;
export function fromPredicate<A>(predicate: Predicate<A>): Affine<A, A> {
  return affine(O.fromPredicate(predicate), identity);
}

/**
 * Construct a Getter<S, A> from an Iso<S, A>;
 */
export function fromIso<S, A>({ view, review }: Iso<S, A>): Getter<S, A> {
  return getter(view, dimap(view, review));
}

/**
 * Given an Optic over a structure with a property P, construct a
 * new Optic at that property P.
 */
export function prop<A, P extends keyof A>(
  prop: P,
): <U extends Tag, S>(
  sa: Optic<U, S, A>,
) => Optic<Align<U, GetTag>, S, A[P]> {
  return compose(
    getter((s) => s[prop], (fii) => (a) => {
      const out = fii(a[prop]);
      return a[prop] === out ? a : { ...a, [prop]: out };
    }),
  );
}

/**
 * Given an Optic over a structure with properties P, construct a new
 * optic that only focuses on those properties
 */
export function props<A, P extends keyof A>(
  ...props: [P, P, ...Array<P>]
): <U extends Tag, S>(
  first: Optic<U, S, A>,
) => Optic<Align<U, GetTag>, S, { [K in P]: A[K] }> {
  const pick = R.pick<A, P>(...props);
  return compose(getter(
    pick,
    (faa) => (a) => {
      const out = faa(pick(a));
      return props.every((prop) => a[prop] === out[prop])
        ? a
        : { ...a, ...out };
    },
  ));
}

/**
 * Given an optic over an array, focus on a value at an index in the
 * array.
 */
export function index(
  i: number,
): <U extends Tag, S, A>(
  first: Optic<U, S, ReadonlyArray<A>>,
) => Optic<Align<U, AffineTag>, S, A> {
  return compose(affine(A.lookup(i), A.modifyAt(i)));
}

/**
 * Given an optic over a record, focus on a value at a key in that
 * record.
 */
export function key(
  key: string,
): <U extends Tag, S, A>(
  first: Optic<U, S, Readonly<Record<string, A>>>,
) => Optic<Align<U, AffineTag>, S, A> {
  return compose(affine(R.lookupAt(key), R.modifyAt(key)));
}

/**
 * Given an Optic focused on A, filter out or refine that A.
 */
export function filter<A, B extends A>(
  r: Refinement<A, B>,
): <U extends Tag, S>(
  first: Optic<U, S, A>,
) => Optic<Align<U, AffineTag>, S, B>;
export function filter<A>(
  r: Predicate<A>,
): <U extends Tag, S>(
  first: Optic<U, S, A>,
) => Optic<Align<U, AffineTag>, S, A>;
export function filter<A>(
  predicate: Predicate<A>,
): <U extends Tag, S>(
  first: Optic<U, S, A>,
) => Optic<Align<U, AffineTag>, S, A> {
  return compose(
    affine(
      O.fromPredicate(predicate),
      (fii) => (a) => predicate(a) ? fii(a) : a,
    ),
  );
}

/**
 * Traverse a U using a Traversable for U. By construction
 * get for a Fold will return an array of values.
 */
export function traverse<T extends Kind>(
  T: Traversable<T>,
): <U extends Tag, S, A, B, C, D, E>(
  first: Optic<U, S, $<T, [A, B, C], [D], [E]>>,
) => Optic<Align<U, FoldTag>, S, A> {
  return compose(
    fold(
      T.reduce((as, a) => as.concat(a), A.empty()),
      T.map,
    ),
  );
}

export function view<S>(
  s: S,
): <U extends Tag, A>(
  viewer: Viewer<U, S, A>,
) => ReturnType<typeof viewer.view> {
  return (viewer) => viewer.view(s);
}

export function modify<A>(faa: (a: A) => A): <S>(
  modifier: Modifier<S, A>,
) => ReturnType<typeof modifier.modify> {
  return (modifier) => modifier.modify(faa);
}

export function replace<A>(a: A): <S>(
  modifier: Modifier<S, A>,
) => ReturnType<typeof modifier.modify> {
  const value = () => a;
  return (modifier) => modifier.modify(value);
}

/**
 * Given an optic over a record, focus on an Option(value) at
 * the given key, allowing one to delete the key by modifying
 * with a None value.
 */
export function atKey(
  key: string,
): <U extends Tag, S, A>(
  first: Optic<U, S, Readonly<Record<string, A>>>,
) => Optic<Align<U, GetTag>, S, Option<A>> {
  const lookup = R.lookupAt(key);
  const _deleteAt = R.deleteAt(key);
  const deleteAt = () => _deleteAt;
  const insertAt = R.insertAt(key);
  return compose(
    getter(
      lookup,
      (faa) => over(flow(lookup, faa, O.match(deleteAt, insertAt))),
    ),
  );
}

/**
 * Construct an Optic over a ReadonlyMap that
 * can lookup a value by key.
 */
export function atMap<B>(
  eq: Eq<B>,
): (
  key: B,
) => <U extends Tag, S, A>(
  first: Optic<U, S, ReadonlyMap<B, A>>,
) => Optic<Align<U, GetTag>, S, Option<A>> {
  return (key: B) => {
    const lookup = M.lookup(eq)(key);
    const _deleteAt = M.deleteAt(eq)(key);
    const deleteAt = () => _deleteAt;
    const insertAt = M.insertAt(eq)(key);
    return compose(getter(
      lookup,
      (faa) => over(flow(lookup, faa, O.match(deleteAt, insertAt))),
    ));
  };
}

/**
 * Collect all values focused on by an Optic into an Array, convert
 * them into a type I, and concat them using the passed Monoid.
 */
export function concatAll<A, I>(M: Monoid<I>, fai: (a: A) => I) {
  const _concatAll = getConcatAll(M);
  return <U extends Tag, S>(first: Optic<U, S, A>): (s: S) => I => {
    const view = cast(first, FoldTag);
    return flow(view, A.map(fai), _concatAll);
  };
}

/**
 * Construct an Optic over the values of a ReadonlyRecord<A>
 */
export const record: <U extends Tag, S, A>(
  first: Optic<U, S, ReadonlyRecord<A>>,
) => Optic<Align<U, FoldTag>, S, A> = traverse(R.TraversableRecord);
/**
 * Construct an Optic over the values of a ReadonlyArray<A>
 */
export const array: <U extends Tag, S, A>(
  first: Optic<U, S, ReadonlyArray<A>>,
) => Optic<Align<U, FoldTag>, S, A> = traverse(A.TraversableArray);

/**
 * Construct an Optic over the values of a ReadonlySet<A>
 */
export const set: <U extends Tag, S, A>(
  first: Optic<U, S, ReadonlySet<A>>,
) => Optic<Align<U, FoldTag>, S, A> = traverse(TraversableSet);

/**
 * Construct an Optic over the values of a Tree<A>
 */
export const tree: <U extends Tag, S, A>(
  first: Optic<U, S, Tree<A>>,
) => Optic<Align<U, FoldTag>, S, A> = traverse(TraversableTree);

/**
 * Wrap an Optic that focuses on a value that can be null or undefined
 * such that it focuses only on non-null values
 */
export const nilable: <U extends Tag, S, A>(
  first: Optic<U, S, A>,
) => Optic<Align<U, AffineTag>, S, NonNullable<A>> = filter(isNotNil);

/**
 * Given an optic focused on an Option<A>, construct
 * an Optic focused within the Option.
 */
export const some: <U extends Tag, S, A>(
  optic: Optic<U, S, Option<A>>,
) => Optic<Align<U, AffineTag>, S, A> = compose(affine(identity, O.map));

/**
 * Given an optic focused on an Either<B, A>, construct
 * an Optic focused on the Right value of the Either.
 */
export const right: <U extends Tag, S, B, A>(
  optic: Optic<U, S, Either<B, A>>,
) => Optic<Align<U, AffineTag>, S, A> = compose(
  affine(E.getRight, E.map),
);

/**
 * Given an optic focused on an Either<B, A>, construct
 * an Optic focused on the Left value of the Either.
 */
export const left: <U extends Tag, S, B, A>(
  optic: Optic<U, S, Either<B, A>>,
) => Optic<Align<U, AffineTag>, S, B> = compose(
  affine(E.getLeft, E.mapLeft),
);

/**
 * Given an optic focused on an Pair<A, B>, construct
 * an Optic focused on the First value of the Pair.
 */
export const first: <U extends Tag, S, B, A>(
  optic: Optic<U, S, Pair<A, B>>,
) => Optic<Align<U, GetTag>, S, A> = compose(getter(P.getFirst, P.map));

/**
 * Given an optic focused on an Pair<A, B>, construct
 * an Optic focused on the Second value of the Pair.
 */
export const second: <U extends Tag, S, B, A>(
  optic: Optic<U, S, Pair<A, B>>,
) => Optic<Align<U, GetTag>, S, B> = compose(getter(P.getSecond, P.mapLeft));
