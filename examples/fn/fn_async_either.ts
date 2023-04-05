import * as F from "../../fn.ts";
import * as FAE from "../../fn_async_either.ts";

const add1 = await F.pipe(
  FAE.ask<number>(),
  FAE.map((n) => n + 1),
  FAE.match(() => 0, F.identity),
);

add1(2).then((n) => console.log(n)); // 3

const failable = F.pipe(
  FAE.tryCatch(
    (n: number) => n % 2 === 0 ? Promise.resolve("even") : Promise.reject("odd"),
    () => "fail: odd",
  ),
  FAE.match(() => "fail: even", F.identity),
);

failable(1).then((n) => console.log(n)); // odd;

const askN = FAE.ask<number>();

const divide = ([dividend, divisor]: [number, number]) => dividend / divisor;
const onError = (error: unknown, [[dividend, divisor]]: [[number, number]]) =>
  `Error dividing ${dividend} by ${divisor}`;
const safeDivide = FAE.tryCatch(divide, onError);

safeDivide([10, 2]); // returns Right(5)
safeDivide([10, 0]); // returns Left("Error dividing 10 by 0")

const _fetch = FAE.tryCatch(
  fetch,
  (error, args) => ({ message: "Fetch Error", error, args }),
);

const t1 = await _fetch("blah")();
const t2 = await _fetch("https://deno.land/")();

const computation = FAE.left<number, number, number>(1);
const result = await computation()();
