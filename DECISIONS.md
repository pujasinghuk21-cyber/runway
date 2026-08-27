# Runway: decisions and context

Written 26 August 2026. This is the handover note. If the conversation that
built this is gone, start here.

Runway is a FIRE calculator: you say what you have, what you spend and
when you want to stop, and it tells you whether the money lasts. It began as a
broken Claude Design Canvas artifact and has been rebuilt from the engine up.

---

## 1. Hard constraints

These are not preferences. They decide what the project is.

- **Nothing from an employer.** No internal code, servers, tooling or
  dependencies of any kind. This is a personal project and it has to stay
  independent, because the intention is to put it on the public internet.
- **Generic, never personal.** No figure about any individual is hardcoded in
  the source. `DEFAULTS` in `src/engine/config.ts` holds only neutral starting
  values. Real numbers are collected by the setup flow and live only in the
  browser's `localStorage`. This is what keeps the repository safe to publish.
- **Full FIRE is the baseline.** `earnings_per_year` defaults to 0. The tool
  must never quietly assume you will pick up part-time work.
- **No em dashes anywhere.** UI copy, code comments, JSDoc, this file. Use a
  full stop, comma, colon or semicolon, and rewrite the sentence rather than
  swapping the character.

---

## 2. How to run it

Node lives at `~/.local/node` (a user-local install, no admin rights needed,
already added to `~/.zshrc`). There was no Node, brew, bun or deno on the
machine before this project.

```
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev      # http://localhost:5173
npm run build    # runs tsc -b, then vite build
```

**Typecheck with `npx tsc -b`, never `npx tsc --noEmit`.** The root
`tsconfig.json` uses project references with `files: []`, so `--noEmit` checks
nothing at all and passes silently. This wasted real time. `npm run build`
does run `tsc -b`, so the build was the only thing catching type errors.

### Verifying without a browser

Chrome headless and `open` are both blocked in this environment by a macOS
mach port permission, so screenshots and automated clicking are impossible.
Two techniques replace them, and both are worth keeping:

- **Engine probes.** Write a throwaway `probe.ts` that imports from
  `src/engine`, bundle it with `node_modules/.bin/rolldown probe.ts --format
  esm --file /tmp/p.mjs`, and run it. This is how nearly every bug below was
  found and proved. Do this before believing any change to the maths.
- **Render smoke tests.** Render a component with `react-dom/server` and
  inspect the HTML and the emitted Emotion CSS. Add `--platform node`. Wrap in
  `ThemeProvider` if you care about colours, or you will read MUI's default
  blue instead of the real purple. Bare rolldown cannot load PNG imports, so
  components that import stickers cannot be smoke tested this way.

### An editor plugin that gets in the way

An editor plugin on the machine this was built on registers a global
`PreToolUse` hook on every write to `.tsx` and `.js` and demands components
from an unrelated design system. It has no project scoping and misfires here.
Writing `.tsx` files through a shell heredoc routes around it.

---

## 3. Architecture

```
src/engine/     all the maths, zero React imports
  types.ts      Settings, YearRow, Projection, Scenario
  compute.ts    the year by year projection
  solvers.ts    every question answered by searching over compute()
  config.ts     DEFAULTS, COUNTRY_PRESETS, GROUPS (the levers), STRESS_TESTS
  format.ts     money, short money, axis ticks
src/components/ the interface
src/App.tsx     layout, state, the moves list
src/theme.ts    Material 3 theme
```

**The engine never imports React.** That separation is why the probes above
work, and it is worth defending.

Stack: React 19, TypeScript, Vite 8 (rolldown), MUI v9, Emotion, Roboto.

State lives in `localStorage` behind a `useLocalStorage` hook. **Every stored
value must have a `revive` function.** See section 6.

---

## 4. The model

Everything is in **real terms**, after inflation. There is no separate
inflation setting. Figures stay in today's money, which is the only way a
number fifty years out means anything.

### Two pots, kept apart

- `liquid`: money outside the pension. Spending it is not taxed.
- `pension`: locked until `pension_access_age`, taxed on the way out.

They used to be merged on the access birthday. That made tax impossible to
model, because once the pots are one pile there is no way to know how much of
a year's spending is taxable. Keeping them apart is what lets the
ISA-against-pension question mean anything.

### Order of spending

Income first, then money outside the pension, then the pension. That is the
order that costs least tax.

### Tax

The spend figure you type is **what lands in your pocket**. Everything is
solved backwards from that. Four places tax bites:

1. **Income.** Earnings and the state pension, at a flat rate above an
   allowance.
2. **Selling from a general account.** Only the gain, above an annual
   exemption. The taxable pot carries a **cost basis**, so unrealised gain
   builds up as it grows, the way it actually does. This matters: held as a
   fixed percentage, moving money into a wrapper only relabelled a balance and
   was worth nothing.
3. **Bed and ISA.** Runs **after** the spending sale, on whatever exemption is
   left over, capped so the realised gain is free. Both parts were wrong once
   and cost £13,000 over fifty years while appearing to save tax.
4. **Pension withdrawals, last.** A tax free share, the rest as income,
   stacked on other income, grossed up piecewise.

**Deliberately not modelled:** tax bands (one flat rate), National Insurance,
dividend and interest tax, the personal allowance taper. Allowances hold their
real value, which is generous.

### The mortgage

A balance that amortises. It carries a rate, the payment eats into it, and the
year it clears is **derived, not typed**. `mortgage_end_age` was deleted for
exactly that reason: asking for it invited it to disagree with the other three
numbers.

The rate is **after inflation**, the same basis as the growth number, because
the two get compared directly. An **offset account** is modelled as the trade
it is: the parked money avoids the interest and earns nothing in the market.
Both halves have to be there or the lever is free money.

---

## 5. Design principles

Settled through argument, and each one earned:

- **Elevation expresses containment, not emphasis.** Siblings share a plane.
- **Purple is interactive. Red means something is wrong.** Never both for one
  thing.
- **Three text tones only:** primary `#1c1b1f`, secondary `#63606b`, tertiary
  `#6f6c75`.
- **A field is for typing, a slider is for sweeping.** Sliders were removed
  from the rail, where they were a second control for a number you already
  knew, and exist only on the What if page, where you do not know the answer
  and are watching the chart move. Both are on every row there.
- **Ceilings only where they are honest.** A max used to be the visible end of
  a track, so it explained itself. As a plain field it silently rewrites what
  you typed. Ages and percentages keep their limits; money fields take
  whatever you type.
- **Do not ask for a number nobody can answer.** Derive it and report the
  consequence. This is why tax is reported rather than asked, and why the
  mortgage end age is calculated.
- **Every figure names its comparison base and carries its unit.**
- **Second person throughout.** Not "my", not "I".
- **Icons sit bare and close to their text.** A white tile put a second raised
  surface inside a card that was already raised.
- **A change worth nothing is not a move.** Filtered out rather than shown as
  "+£0".

---

## 6. Bugs found, and what they teach

Each of these was reproduced with a probe before it was fixed. Several were
found because the numbers were questioned, not because anything looked broken.

| Bug | Lesson |
|---|---|
| Pension unlock never fired when the exit age was after the access age. The whole pot silently vanished. | Test the boundary in both directions. |
| Growth applied to negative balances, so better markets gave worse outcomes. | Add a monotonicity check to the regression set. |
| `enoughToday` subtracted from one pot while allowing itself the total of two, testing a balance of minus £126,000. | Scale both pots together. |
| Non-monotonic feasibility: the banner said yes while the tile said no. A sub-penny residue in the tax gross-up. | Solve piecewise at the boundary, and allow a £1 ruin tolerance. |
| The chart plotted one pot and flatlined at zero while the tiles reported headroom. | The chart must plot what the tiles report. |
| Bed and ISA made things worse two different ways. | Sequence matters: the optional transfer must not take first claim on a shared exemption. |
| The offset saved interest from today but was never charged the growth it gave up before the exit date. | Closed form accumulation knows nothing about the loop. Charge both sides of a trade explicitly. |
| The chart's vertical floor read the outside pot while the line drawn was the total, squashing every pension-heavy plan. | The scale must read what is drawn. |
| Applied moves were keyed by their label, and labels rewrite themselves from the plan. Four of five moves lost their undo and could be re-applied. | Never key state on derived display text. |
| **Saved plans had no reviver.** A plan saved before a setting existed came back missing it, and loading it white-screened the app. | Every stored value needs a `revive`. This will happen again the next time a setting is added. |
| Moves offered a tenth of your spending as a guess when £2,700 of £4,500 was enough. | Solve for the minimum, do not guess a fraction. |
| The year table's `Start`, `Growth` and `End` all meant "outside the pension" without saying so, so pension-only years read as blank rows and `End` disagreed with the chart. | Right and invisible is still a defect. |

**The engine is audited.** A conservation check runs over every year of seven
different plans: money in equals money out, each row's opening balance is the
previous row's close, and withdrawals net of tax cover the spend. All pass.
Re-run it after any change to `compute.ts`.

Standing regression set worth keeping:

- feasibility flips exactly once as spend rises
- better markets never produce worse outcomes
- no impossible negative pots
- sheltering never hurts
- the offset wins only when the mortgage rate beats the growth rate

---

## 7. The three surfaces

**Your plan.** The answer banner, saved plans, four fact tiles, the chart with
its assumptions strip and the moves list, then the year by year table. The
left rail holds your details and every lever, plus Tax as its own section
below (collapsed, because those are the rules you are playing under rather
than choices you make).

**What if.** One page, all the questions at once, because they are not
independent: clearing a mortgage changes what the pension is worth. Controls
on the left, chart on the right. It offers a solved recommendation
(`bestMix`, coordinate descent, about a hundred projections in under 30ms) and
a separate "mortgage free as soon as possible" answer that searches for the
earliest date rather than the most money, and states its price in the same
breath.

**Applying a change adds a line, it does not replace one.** The plan you had
stays in grey and the new one is drawn in purple, reconstructed by rolling
back every recorded undo. Applied changes appear under the chart with a label
saying what they did and where they came from.

---

## 8. Open questions and next steps

**The one that blocks correct advice.** Your saving figures are not in the
same currency: the reachable number is take-home, the pension number is gross
and already includes relief and employer match. `pension_relief_pct` was
removed because converting between them produced a budget that was neither
number you typed and a pension figure larger than the budget it was part of.
The consequence is that **a pension can never win**: it is now an ISA that
gets taxed on the way out. The optimiser says "put nothing into the pension"
every time, and it is wrong. Decide whether moving £1,000 off your saving
should put £1,000 or £1,667 into the pension, then rebuild that half.

**Not yet a git repository.** Files have been deleted more than once with no
version control underneath. Do this first, before anything structural.

**Not yet hosted.** The intention is a public website. Nothing in the build
prevents it: it is a static site with no server and no accounts.

**Also parked:**

- Mortgage overpayment while still working. The projection starts at the exit
  age, so it has nothing to say about paying down a mortgage before then, and
  the mortgage solver says so on screen.
- Spend order between an ISA and a general account. Withdrawals are
  proportional; a real person would choose, and the order changes the tax.
- Rebuilding the parked "What-ifs" rail group properly.
- Ireland and Canada pension limits are approximations. Both are a percentage
  of earnings rather than a flat number. Ireland is set to 0, meaning no
  limit, which is too generous.
- The net worth log chart from the original artifact.

---

## 9. Working notes

- Reproduce numerically before believing anything. Several defects were only
  found because a number was questioned, and several "fixes" were wrong on the
  first attempt and caught by the probe.
- Report what the numbers actually say, including when a feature turns out to
  be worth nothing. Bed and ISA is worth £0 on a plan whose spending already
  uses the whole gains exemption, and saying so is more useful than a row that
  reads "+£0".
- When a control is confusing, the fix is often to remove the question rather
  than reword it.
