# Runway

Check whether your money lasts after you stop working.

You say what you have, what you put away, when you want to stop and what you
expect to spend. Runway works out whether the plan holds to the age you set,
the earliest age it becomes true, and which single change moves it most.

Built for the UK: ISAs, general accounts, a pension locked until an access
age, income tax, capital gains, and a mortgage that amortises properly.

**Everything runs in the browser.** No account, no server, no analytics.
Your plan lives in `localStorage` and nothing is ever sent anywhere. You can
download it as a PDF or a spreadsheet, both generated on your own machine.

## Running it

```sh
npm install     # first time only
npm run dev     # http://localhost:5173
npm run build   # static files land in dist/
npm run preview # check the built version locally
```

`dist/` is plain HTML, CSS and JS. It will sit on GitHub Pages, Netlify,
Vercel, Cloudflare Pages or any static host. Nothing server-side is needed.

**Typecheck with `npx tsc -b`, not `npx tsc --noEmit`.** The root
`tsconfig.json` uses project references with `files: []`, so `--noEmit`
checks nothing at all and passes silently. `npm run build` runs `tsc -b`.

## How it is put together

```
src/
  engine/          all the maths, and no React anywhere in it
    types.ts       the shape of a plan
    config.ts      generic defaults, the levers, UK rules, stress tests
    compute.ts     the year-by-year projection
    solvers.ts     earliest exit, spending ceiling, how much is enough
    planData.ts    what a downloaded plan contains, shared by both formats
    exportPdf.ts   the plan as a document
    pdf.ts         a small PDF writer, no dependency
    exportCsv.ts   the plan as a spreadsheet
    format.ts      money, short money, axis ticks
    history.ts     real market returns, currently switched off
    risk.ts        Monte Carlo, currently unused
  components/      the interface
  theme.ts         the Material 3 theme
  App.tsx          state, derived values, page composition
```

**The engine never imports React.** That separation is what lets any of the
maths be checked by bundling a throwaway script against it and running the
numbers, which is how every defect in it has been found.

## The model, in short

Everything is in **real terms**, after inflation, so a figure fifty years out
still means something. You give a growth rate before inflation and an
inflation rate, and the projection compounds the difference. It is a
division, not a subtraction: 7% with 2.5% inflation leaves 4.39% real.

Two pots stay separate for the whole plan, because they are taxed
differently: what you can reach, and a pension locked until its access age.
The gap between stopping and the pension opening is where plans actually
fail, so the low point across those years is reported on its own.

Money is drawn in the order that costs least tax: income first, then what you
can reach, then the pension. The taxable account carries a cost basis, so
unrealised gain builds up the way it really does.

Everything the tool takes for granted is listed on the "How it works" panel
in the app, with your own numbers in, including the parts that flatter the
answer.

## Three rules worth keeping

**Nothing personal in `config.ts`.** The defaults are illustrative round
numbers. A real plan comes from the setup flow and stays in the browser. This
is what makes the repository safe to publish.

**No assumed income.** `earnings_per_year` defaults to `0`, which is proper
FIRE. Work income is something you opt into, never something the tool quietly
assumes for you.

**Reproduce before believing.** Several defects here were found only because
a number looked wrong and was checked, and several first attempts at fixing
them were wrong too. `DECISIONS.md` lists them and what each one taught.

## Not advice

This is a calculator. It is not regulated financial advice, it does not know
your circumstances, and its assumptions are listed precisely so you can
disagree with them.

## Licence

MIT. See `LICENSE`.

Emoji are Microsoft's Fluent Emoji, MIT licensed, vendored under
`src/assets/emoji` so the site depends on nobody else's CDN.
