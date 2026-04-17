import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

type Params = {
  rows: number;
  cols: number;
  intervalLengthMin: number;
  intervalCount: number;
};

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;
const DEFAULT_INTERVAL = 90;

const clamp = (value: number, min: number, max: number) =>
  Number.isNaN(value) ? min : Math.min(Math.max(value, min), max);

const getDivisors = (value: number) => {
  const divisors: number[] = [];
  for (let i = 1; i <= value; i += 1) {
    if (value % i === 0) divisors.push(i);
  }
  return divisors;
};

const chooseClosestDivisor = (interval: number, target: number) => {
  const divisors = getDivisors(interval);
  if (divisors.length === 0) return 1;
  return divisors.reduce((closest, divisor) => {
    const currentDistance = Math.abs(divisor - target);
    const bestDistance = Math.abs(closest - target);
    return currentDistance < bestDistance ? divisor : closest;
  }, divisors[0]);
};

const normalizeParams = (raw: Partial<Params>): Params => {
  const rows = clamp(raw.rows ?? DEFAULT_ROWS, 1, 25);
  const cols = clamp(raw.cols ?? DEFAULT_COLS, 1, 25);
  const interval = clamp(raw.intervalLengthMin ?? DEFAULT_INTERVAL, 1, 1440);
  const targetCount = rows * cols * 2;
  const defaultCount = chooseClosestDivisor(interval, targetCount);
  let intervalCount = clamp(raw.intervalCount ?? defaultCount, 1, interval);

  if (interval % intervalCount !== 0) {
    intervalCount = defaultCount;
  }

  return {
    rows,
    cols,
    intervalLengthMin: interval,
    intervalCount,
  };
};

const parseSearchParams = (search: string): Params => {
  const params = new URLSearchParams(search);
  const parseNumber = (key: string) => {
    const value = params.get(key);
    return value === null ? undefined : Number(value);
  };

  return normalizeParams({
    rows: parseNumber("rows"),
    cols: parseNumber("cols"),
    intervalLengthMin: parseNumber("interval"),
    intervalCount: parseNumber("intervalCount"),
  });
};

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours)}:${String(mins).padStart(2, "0")}`;
};

const generateIntervals = (
  intervalDurationMin: number,
  intervalCount: number,
) => {
  const sliceDurationMin = intervalDurationMin / intervalCount;
  const startMinute = 0;
  return Array.from({ length: intervalCount }, (_, index) => {
    const start = startMinute + index * sliceDurationMin;
    const end = startMinute + (index + 1) * sliceDurationMin;
    return `${formatTime(start)} - ${formatTime(end)}`;
  });
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getRandomGrid = (items: string[], count: number) =>
  shuffle(items).slice(0, count);

function App() {
  const [params, setParams] = useState<Params>(() =>
    parseSearchParams(window.location.search),
  );
  const [batchSize, setBatchSize] = useState(1);
  const [batchGrids, setBatchGrids] = useState<string[][]>([]);

  useEffect(() => {
    const search = new URLSearchParams({
      rows: String(params.rows),
      cols: String(params.cols),
      interval: String(params.intervalLengthMin),
      intervalCount: String(params.intervalCount),
    }).toString();

    const nextUrl = `${window.location.pathname}?${search}`;
    window.history.replaceState({}, "", nextUrl);
  }, [params]);

  useEffect(() => {
    setBatchGrids([]);
  }, [params]);

  const handleBatchSize = (event: ChangeEvent<HTMLInputElement>) => {
    setBatchSize(clamp(Number(event.target.value), 1, 50));
  };

  const handleGenerateBatch = () => {
    if (batchSize < 1) {
      return;
    }
    setBatchGrids(
      Array.from({ length: batchSize }, () =>
        getRandomGrid(intervalLabels, params.rows * params.cols),
      ),
    );
  };

  const intervalLabels = useMemo(
    () => generateIntervals(params.intervalLengthMin, params.intervalCount),
    [params.intervalLengthMin, params.intervalCount],
  );

  const gridItems = useMemo(
    () => getRandomGrid(intervalLabels, params.rows * params.cols),
    [intervalLabels, params.rows, params.cols],
  );

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.name as keyof Params;
    const value = clamp(Number(event.target.value), 1, 1440);
    setParams((current) => normalizeParams({ ...current, [name]: value }));
  };

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Time Bingo</p>
          <h1>Generate a timed bingo sheet</h1>
          <p className="lead">
            Choose grid dimensions, interval length, and how many time slots to
            generate. All values are saved in the URL automatically.
          </p>
        </div>
      </section>

      <section className="controls-panel">
        <div className="control-row">
          <label>
            Rows
            <input
              type="number"
              name="rows"
              min={1}
              max={25}
              value={params.rows}
              onChange={handleInput}
            />
          </label>
          <label>
            Columns
            <input
              type="number"
              name="cols"
              min={1}
              max={25}
              value={params.cols}
              onChange={handleInput}
            />
          </label>
          <label>
            Total interval (min)
            <input
              type="number"
              name="interval"
              min={1}
              max={1440}
              value={params.intervalLengthMin}
              onChange={handleInput}
            />
          </label>
          <label>
            Time intervals
            <input
              type="number"
              name="intervalCount"
              min={1}
              max={params.intervalLengthMin}
              value={params.intervalCount}
              onChange={handleInput}
            />
          </label>
        </div>

        <div className="summary-row">
          <p>
            Slot length:{" "}
            <strong>
              {params.intervalLengthMin / params.intervalCount} minutes
            </strong>
          </p>
          <p>
            Candidate intervals: <strong>{intervalLabels.length}</strong>
          </p>
        </div>
      </section>

      <section className="grid-panel" aria-label="Bingo sheet">
        <div
          className="bingo-grid"
          style={{
            gridTemplateColumns: `repeat(${params.cols}, minmax(120px, 1fr))`,
          }}
        >
          {gridItems.map((label, index) => (
            <div key={`${label}-${index}`} className="grid-cell">
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="batch-panel">
        <div className="batch-controls">
          <label>
            Generate a printable version with one grid per sheet:
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={handleBatchSize}
            />
          </label>
          <button
            type="button"
            className="batch-button"
            onClick={handleGenerateBatch}
          >
            Generate {batchSize} printable grids
          </button>
        </div>

        {batchGrids.length > 0 && (
          <div className="print-batch">
            {batchGrids.map((grid, batchIndex) => (
              <div key={batchIndex} className="print-grid-page">
                <h2>
                  Time Bingo {batchIndex + 1} / {batchGrids.length}
                </h2>
                <div
                  className="print-grid"
                  style={{
                    gridTemplateColumns: `repeat(${params.cols}, minmax(120px, 1fr))`,
                  }}
                >
                  {grid.map((label, index) => (
                    <div key={`${batchIndex}-${index}`} className="print-cell">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
