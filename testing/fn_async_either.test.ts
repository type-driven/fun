import { assertEquals } from "https://deno.land/std@0.103.0/testing/asserts.ts";

import * as FAE from "../fn_async_either.ts";
import * as AE from "../async_either.ts";
import * as E from "../either.ts";
import * as F from "../fn.ts";
import { pipe } from "../fn.ts";
import { then, wait } from "../promise.ts";

const add = (n: number) => n + 1;

const assertEqualsT = async (
  a: FAE.FnAsyncEither<unknown, unknown, unknown>,
  b: FAE.FnAsyncEither<unknown, unknown, unknown>,
) => assertEquals(await a({})(), await b({})());

function throwSync(n: number): number {
  if (n % 2 === 0) {
    throw new Error(`Number '${n}' is divisible by 2`);
  }
  return n;
}

async function throwAsync(n: number): Promise<number> {
  await wait(200);
  if (n % 2 === 0) {
    return Promise.reject(`Number '${n}' is divisible by 2`);
  }
  return n;
}

Deno.test("FnAsyncEither left", async () => {
  await assertEqualsT(F.of(AE.left(1)), FAE.left(1));
});

Deno.test("FnAsyncEither right", async () => {
  await assertEqualsT(() => AE.right(1), FAE.right(1));
});

Deno.test("FnAsyncEither tryCatch", async (t) => {
  await t.step("Sync", async () => {
    const computation = FAE.tryCatch(throwSync, () => "Bad");
    await assertEqualsT(
      () => computation(1),
      FAE.right(1),
    );
    await assertEqualsT(
      () => computation(2),
      FAE.left("Bad"),
    );
  });
  await t.step("Async", async () => {
    const computation = FAE.tryCatch(throwAsync, () => "Bad");
    await assertEqualsT(
      () => computation(1),
      FAE.right(1),
    );
    await assertEqualsT(
      () => computation(2),
      FAE.left("Bad"),
    );
  });
});

Deno.test("FnAsyncEither fromEither", async () => {
  await assertEqualsT(FAE.fromEither(E.left(1)), FAE.left(1));
  await assertEqualsT(FAE.fromEither(E.right(1)), FAE.right(1));
});

Deno.test("FnAsyncEither then", async () => {
  assertEquals(
    await pipe(Promise.resolve(1), then(add)),
    await Promise.resolve(2),
  );
});

Deno.test("FnAsyncEither of", async () => {
  await assertEqualsT(() => AE.of(1), FAE.of(1));
});

Deno.test("FnAsyncEither map", async () => {
  await assertEqualsT(pipe(FAE.of(1), FAE.map(add)), FAE.right(2));
  await assertEqualsT(pipe(FAE.left<number, any, any>(1), FAE.map(add)), FAE.left(1));
});

Deno.test("FnAsyncEither join", async () => {
  await assertEqualsT(FAE.join(FAE.right(FAE.right(1))), FAE.right(1));
  await assertEqualsT(FAE.join(FAE.right(FAE.left(1))), FAE.left(1));
  await assertEqualsT(FAE.join(FAE.left(1)), FAE.left(1));
});

Deno.test("FnAsyncEither chain", async () => {
  const chain = FAE.chain(
    (n: number) => n === 0 ? FAE.left(0) : FAE.right(1),
  );
  await assertEqualsT(chain(FAE.right(0)), FAE.left(0));
  await assertEqualsT(chain(FAE.right(1)), FAE.right(1));
  await assertEqualsT(chain(FAE.left(1)), FAE.left(1));
});

Deno.test("FnAsyncEither bimap", async () => {
  const bimap = FAE.bimap(add, add);
  await assertEqualsT(bimap(FAE.right(1)), FAE.right(2));
  await assertEqualsT(bimap(FAE.left(1)), FAE.left(2));
});

Deno.test("FnAsyncEither mapLeft", async () => {
  await assertEqualsT(pipe(FAE.of(1), FAE.mapLeft(add)), FAE.right(1));
  await assertEqualsT(pipe(FAE.left<number, any, any>(1), FAE.mapLeft(add)), FAE.left(2));
});

Deno.test("FnAsyncEither apSequential", async () => {
  await assertEqualsT(
    pipe(FAE.of(add), FAE.apSequential(FAE.of(1))),
    FAE.right(2),
  );
  await assertEqualsT(
    pipe(FAE.of(add), FAE.apSequential(FAE.left(1))),
    FAE.left(1),
  );
});

Deno.test("FnAsyncEither apParallel", async () => {
  await assertEqualsT(
    pipe(FAE.of(add), FAE.apParallel(FAE.right(1))),
    FAE.right(2),
  );
  await assertEqualsT(
    pipe(FAE.of(add), FAE.apParallel(FAE.left(1))),
    FAE.left(1),
  );
});

Deno.test("FnAsyncEither alt", async () => {
  await assertEqualsT(pipe(FAE.left(1), FAE.alt(FAE.left(2))), FAE.left(2));
  await assertEqualsT(pipe(FAE.left(1), FAE.alt(FAE.right(2))), FAE.right(2));
  await assertEqualsT(pipe(FAE.right(1), FAE.alt(FAE.left(2))), FAE.right(1));
  await assertEqualsT(pipe(FAE.right(1), FAE.alt(FAE.right(2))), FAE.right(1));
});

Deno.test("FnAsyncEither chainLeft", async () => {
  const chainLeft = FAE.chainLeft((
    n: number,
  ): FAE.FnAsyncEither<any[], any, any> => n === 0 ? FAE.right(n) : FAE.left(n));
  await assertEqualsT(chainLeft(FAE.right(0)), FAE.right(0));
  await assertEqualsT(chainLeft(FAE.left(0)), FAE.right(0));
  await assertEqualsT(chainLeft(FAE.left(1)), FAE.left(1));
});

Deno.test("FnAsyncEither match", async () => {
  const match = FAE.match((l: string) => l, String);

  assertEquals(await match(FAE.right(1))({}), "1");
  assertEquals(await match(FAE.left("asdf"))({}), "asdf");
});

// Deno.test("FnAsyncEither Do, bind, bindTo", () => {
//   assertEqualsT(
//     pipe(
//       FAE.Do<number, number, number>(),
//       FAE.bind("one", () => FAE.right(1)),
//       FAE.bind("two", ({ one }) => FAE.right(one + one)),
//       FAE.map(({ one, two }) => one + two),
//     ),
//     FAE.right(3),
//   );
//   assertEqualsT(
//     pipe(
//       FAE.right(1),
//       FAE.bindTo("one"),
//     ),
//     FAE.right({ one: 1 }),
//   );
// });
