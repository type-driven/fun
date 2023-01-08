import type { Category } from "../category.ts";
import type { Monoid } from "../monoid.ts";
import type { Kind } from "../kind.ts";

export interface Fix<A> extends Kind {
  readonly kind: A;
}

const CategoryNumberSum: Category<Fix<number>> = {
  id: () => 0,
  compose: (second) => (first) => first + second,
};

const MonoidNumberSum: Monoid<number> = {
  empty: () => 0,
  concat: (second) => (first) => first + second,
};
