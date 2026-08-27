/**
 * Real market history, and the plan run through it.
 *
 * The other three market views are one number each: your rate, a bit less, a
 * bit more. Every year the same. That is not what markets do and no amount of
 * lowering the number makes it so, because the damage is done by the order,
 * not the average. A run of bad years at the start sells the most units and
 * never gets them back.
 *
 * This runs the plan through what actually happened. Start it in 1900, use
 * the returns of 1900, 1901, 1902 and so on. Then start it in 1901 and do it
 * again. Each starting year is a cohort, and the answer is how many of them
 * survived, along with the worst one, which is a real date rather than an
 * invented pessimism.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHERE THE NUMBERS CAME FROM
 *
 * Robert Shiller's US stock market dataset, the one behind Irrational
 * Exuberance, downloaded from shillerdata.com on 27 August 2026. The file is
 * ie_data.xls and it is free. The Yale link that used to host it is dead.
 *
 * Column J of the Data sheet is a real total return index for the S&P
 * composite, monthly from January 1871. Each year here is that index in
 * January against the following January, so it is a calendar year measured
 * on monthly average prices. That differs slightly from a close to close
 * calendar year, which is why 2008 reads -35.7% rather than the -37% you
 * will see quoted elsewhere. Same market, different measuring points.
 *
 * Checks it passes: the series compounds at 7.09% real over 155 years with a
 * 17.7% yearly swing, which is where US equity history is normally put; 1933
 * is +53%, 1954 is +48%, 1974 is -29%, 2008 is -36%.
 *
 * THE LIMITATION THAT MATTERS: this is the United States, and the United
 * States is the best performing large market of the last century. World
 * equities compound nearer 5% real and the UK nearer 5.4%. Running a British
 * plan through American history is optimistic by well over a point a year,
 * which over fifty years is enormous. Treat this tab as "what if you had
 * lived through the luckiest market", not as a neutral base case. The honest
 * upgrade is the Dimson, Marsh and Staunton world series, which is not free.
 * ────────────────────────────────────────────────────────────────────────
 */

import type { Settings } from './types';
import { compute, feasible } from './compute';

/**
 * Where the numbers came from. Shown on screen so the tab can be checked.
 *
 * Empty on purpose: turned off on 27 August 2026, not deleted. The tab was
 * answering a question honestly and nobody could tell what it was answering,
 * which makes it worse than absent. The data below is real and checked, and
 * everything that reads it still works.
 *
 * To bring the tab back, put the description on the line below back:
 *   export const SOURCE: string = 'US shares, Shiller, 1871 to 2025';
 */
export const SOURCE: string = '';

/** One entry per calendar year: `[year, real total return %]`. */
export const REAL_RETURNS: readonly (readonly [number, number])[] = [
  [1871, 13.91], [1872, 8.78], [1873, 2.03], [1874, 12.5], [1875, 11.82], [1876, -14.92],
  [1877, 16.97], [1878, 29.62], [1879, 23.8], [1880, 34.37], [1881, -7.19], [1882, 5.59],
  [1883, 2.31], [1884, -2.31], [1885, 34.54], [1886, 11.94], [1887, -5.15], [1888, 8.21],
  [1889, 12.42], [1890, -8.45], [1891, 26.6], [1892, -1.52], [1893, -6.39], [1894, 8.06],
  [1895, 3.46], [1896, 6.26], [1897, 16.93], [1898, 27.52], [1899, -11.31], [1900, 23.94],
  [1901, 16.59], [1902, -1.23], [1903, -13.28], [1904, 29.13], [1905, 21.31], [1906, -3.63],
  [1907, -22.52], [1908, 34.97], [1909, 5.02], [1910, 3.59], [1911, 4.6], [1912, -0.1],
  [1913, -6.64], [1914, -6.41], [1915, 27.43], [1916, -3.79], [1917, -31.92], [1918, 0.18],
  [1919, 2.27], [1920, -12.62], [1921, 23.76], [1922, 29.9], [1923, 2.41], [1924, 27.12],
  [1925, 21.65], [1926, 14.11], [1927, 38.75], [1928, 49.35], [1929, -9.43], [1930, -16.9],
  [1931, -38.03], [1932, 4.02], [1933, 53.1], [1934, -10.71], [1935, 52.71], [1936, 29.89],
  [1937, -32.56], [1938, 18.95], [1939, 3.8], [1940, -10.17], [1941, -18.34], [1942, 12.97],
  [1943, 20.07], [1944, 17], [1945, 36.3], [1946, -25.53], [1947, -6.89], [1948, 8.2],
  [1949, 20.11], [1950, 24.51], [1951, 16.83], [1952, 14.26], [1953, 1.88], [1954, 47.93],
  [1955, 28.46], [1956, 3.78], [1957, -9.09], [1958, 38.44], [1959, 6.55], [1960, 4.76],
  [1961, 18.3], [1962, -3.86], [1963, 19.27], [1964, 14.89], [1965, 9.52], [1966, -9.53],
  [1967, 12.04], [1968, 5.97], [1969, -13.87], [1970, 2.14], [1971, 10.39], [1972, 13.72],
  [1973, -23.46], [1974, -29.39], [1975, 30.44], [1976, 5.73], [1977, -14.82], [1978, 6.4],
  [1979, 2.86], [1980, 12.73], [1981, -14.38], [1982, 25.48], [1983, 15.54], [1984, 4.26],
  [1985, 21.68], [1986, 29.52], [1987, -6.17], [1988, 12.7], [1989, 16.93], [1990, -6.13],
  [1991, 28.61], [1992, 4.34], [1993, 8.96], [1994, -1.6], [1995, 31.74], [1996, 23.62],
  [1997, 25.94], [1998, 29.35], [1999, 12.5], [2000, -8.62], [2001, -14.45], [2002, -22.15],
  [2003, 26.15], [2004, 3], [2005, 5.92], [2006, 11.09], [2007, -5.47], [2008, -35.65],
  [2009, 29.85], [2010, 14.52], [2011, 0.47], [2012, 14.4], [2013, 23.66], [2014, 13.58],
  [2015, -4.75], [2016, 18.16], [2017, 22.46], [2018, -6.2], [2019, 25.04], [2020, 16.24],
  [2021, 13.71], [2022, -17.31], [2023, 19.83], [2024, 22.15], [2025, 14.6],
];

export const hasHistory = () => REAL_RETURNS.length > 0 && SOURCE !== '';

export interface Cohort {
  /** Calendar year the plan started in. */
  startYear: number;
  survived: boolean;
  /** Age the money ran out, or null. */
  ranOutAt: number | null;
  endBal: number;
}

export interface HistoryResult {
  source: string;
  cohorts: Cohort[];
  /** How many started, and how many lasted the whole plan. */
  tested: number;
  survived: number;
  /** The starting year that went worst, which is a date you can look up. */
  worst: Cohort | null;
  /** The median cohort by ending balance, as the typical case. */
  median: Cohort | null;
}

/**
 * Run the plan once for every start year with enough history after it.
 *
 * A plan needs `plan_to - exit_age + 1` years of returns, so on a 125 year
 * series a 50 year plan gives 75 usable starting points. Short series and
 * long plans give very few cohorts, and few cohorts is a weak answer, so the
 * count is reported rather than hidden.
 */
export function runHistory(s: Settings): HistoryResult | null {
  if (!hasHistory()) return null;

  const years = Math.max(1, s.plan_to - s.exit_age + 1);
  const series = REAL_RETURNS;
  if (series.length < years) return null;

  const cohorts: Cohort[] = [];
  for (let i = 0; i + years <= series.length; i++) {
    const path = series.slice(i, i + years).map(([, r]) => r / 100);
    const res = compute(s, path);
    cohorts.push({
      startYear: series[i][0],
      survived: feasible(res),
      ranOutAt: res.runsOutAge,
      endBal: res.endBal,
    });
  }

  if (cohorts.length === 0) return null;

  const byEnd = [...cohorts].sort((a, b) => a.endBal - b.endBal);
  return {
    source: SOURCE,
    cohorts,
    tested: cohorts.length,
    survived: cohorts.filter((c) => c.survived).length,
    worst: byEnd[0] ?? null,
    median: byEnd[Math.floor(byEnd.length / 2)] ?? null,
  };
}

/**
 * The returns of the single worst starting year, for the chart to draw.
 *
 * This is what the historical tab plots: not an average of history, one real
 * run of it. "Your plan started in 1929" is a sentence someone can hold on to
 * in a way that "the tenth percentile" is not.
 */
export function worstPath(s: Settings): { path: number[]; startYear: number } | null {
  const h = runHistory(s);
  if (!h || !h.worst) return null;
  const years = Math.max(1, s.plan_to - s.exit_age + 1);
  const i = REAL_RETURNS.findIndex(([y]) => y === h.worst!.startYear);
  if (i < 0) return null;
  return {
    path: REAL_RETURNS.slice(i, i + years).map(([, r]) => r / 100),
    startYear: h.worst.startYear,
  };
}

/**
 * The most you could spend and still have survived this share of real starts.
 *
 * The counting on its own tells you there is a problem and not what to do
 * about it. "58 of 106 survived" leaves you to find the number that fixes it
 * by dragging the spend field and watching, which is a search a computer
 * should do.
 *
 * A target of 1 means every start, including 1929 and 1966, which is the
 * strictest thing history can tell you. It is also the number most people
 * actually want: not a probability, a level of spending that has never once
 * failed on the record we have.
 */
export function safeHistorySpend(s: Settings, target: number): number {
  if (!hasHistory()) return 0;
  const survives = (spend: number) => {
    const h = runHistory({ ...s, annual_spend: spend });
    return h ? h.survived / h.tested : 0;
  };
  if (survives(0) < target) return 0;

  let lo = 0;
  let hi = Math.max(20_000, s.annual_spend * 4);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (survives(mid) >= target) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 100) * 100;
}
