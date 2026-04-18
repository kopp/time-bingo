import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

type Params = {
  rows: number;
  cols: number;
  intervalLengthMin: number;
  intervalCount: number;
  startTime: number;
};

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;
const DEFAULT_INTERVAL = 90;
const DEFAULT_START_TIME = 9 * 60; // 9:00 in minutes

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

const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return 0;
  }
  return parts[0] * 60 + parts[1];
};

const isValidTimeFormat = (timeStr: string): boolean => {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return false;
  const [hours, mins] = parts.map(Number);
  return (
    !Number.isNaN(hours) &&
    !Number.isNaN(mins) &&
    hours >= 0 &&
    hours < 24 &&
    mins >= 0 &&
    mins < 60
  );
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

  let startTime = DEFAULT_START_TIME;
  if (raw.startTime !== undefined) {
    if (typeof raw.startTime === "number") {
      startTime = clamp(raw.startTime, 0, 24 * 60 - 1);
    } else if (
      typeof raw.startTime === "string" &&
      isValidTimeFormat(raw.startTime)
    ) {
      startTime = parseTime(raw.startTime);
    }
  }

  return {
    rows,
    cols,
    intervalLengthMin: interval,
    intervalCount,
    startTime,
  };
};

const parseSearchParams = (search: string): Params => {
  const params = new URLSearchParams(search);
  const parseNumber = (key: string) => {
    const value = params.get(key);
    return value === null ? undefined : Number(value);
  };

  const startTimeStr = params.get("startTime");
  const startTime =
    startTimeStr && isValidTimeFormat(startTimeStr)
      ? parseTime(startTimeStr)
      : undefined;

  return normalizeParams({
    rows: parseNumber("rows"),
    cols: parseNumber("cols"),
    intervalLengthMin: parseNumber("interval"),
    intervalCount: parseNumber("intervalCount"),
    startTime,
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
  startTimeMin: number,
) => {
  const sliceDurationMin = intervalDurationMin / intervalCount;
  return Array.from({ length: intervalCount }, (_, index) => {
    const start = startTimeMin + index * sliceDurationMin;
    const end = startTimeMin + (index + 1) * sliceDurationMin;
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
  const [rowsInput, setRowsInput] = useState(String(params.rows));
  const [colsInput, setColsInput] = useState(String(params.cols));
  const [intervalInput, setIntervalInput] = useState(
    String(params.intervalLengthMin),
  );
  const [intervalCountInput, setIntervalCountInput] = useState(
    String(params.intervalCount),
  );
  const [startTimeInput, setStartTimeInput] = useState(
    formatTime(params.startTime),
  );
  const [batchSizeInput, setBatchSizeInput] = useState(String(1));
  const [batchGrids, setBatchGrids] = useState<string[][]>([]);

  useEffect(() => {
    const search = new URLSearchParams({
      rows: String(params.rows),
      cols: String(params.cols),
      interval: String(params.intervalLengthMin),
      intervalCount: String(params.intervalCount),
      startTime: formatTime(params.startTime),
    }).toString();

    const nextUrl = `${window.location.pathname}?${search}`;
    window.history.replaceState({}, "", nextUrl);
  }, [params]);

  useEffect(() => {
    setBatchGrids([]);
  }, [params]);

  const handleBatchSize = (event: ChangeEvent<HTMLInputElement>) => {
    setBatchSizeInput(event.target.value);
  };

  const handleGenerateSheet = () => {
    const rows = clamp(Number(rowsInput) || params.rows, 1, 25);
    const cols = clamp(Number(colsInput) || params.cols, 1, 25);
    const interval = clamp(
      Number(intervalInput) || params.intervalLengthMin,
      1,
      1440,
    );
    let intervalCount = clamp(
      Number(intervalCountInput) || params.intervalCount,
      1,
      interval,
    );

    const originalIntervalCount = intervalCount;
    if (interval % intervalCount !== 0) {
      intervalCount = chooseClosestDivisor(interval, intervalCount);
      window.alert(
        `The closest valid interval count is ${intervalCount}. This value will be applied.`,
      );
    }

    let startTime = params.startTime;
    if (isValidTimeFormat(startTimeInput)) {
      startTime = parseTime(startTimeInput);
    } else {
      window.alert("Invalid start time format. Please use HH:MM format.");
      setStartTimeInput(formatTime(params.startTime));
    }

    setParams(
      normalizeParams({
        rows,
        cols,
        intervalLengthMin: interval,
        intervalCount,
        startTime,
      }),
    );

    setRowsInput(String(rows));
    setColsInput(String(cols));
    setIntervalInput(String(interval));
    setIntervalCountInput(String(intervalCount));
    setStartTimeInput(formatTime(startTime));
  };

  const handleGenerateBatch = () => {
    const batchSize = clamp(Number(batchSizeInput), 1, 50);
    setBatchSizeInput(String(batchSize));

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
    () =>
      generateIntervals(
        params.intervalLengthMin,
        params.intervalCount,
        params.startTime,
      ),
    [params.intervalLengthMin, params.intervalCount, params.startTime],
  );

  const gridItems = useMemo(
    () => getRandomGrid(intervalLabels, params.rows * params.cols),
    [intervalLabels, params.rows, params.cols],
  );

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
              min={1}
              max={25}
              value={rowsInput}
              onChange={(event) => setRowsInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerateSheet();
              }}
            />
          </label>
          <label>
            Columns
            <input
              type="number"
              min={1}
              max={25}
              value={colsInput}
              onChange={(event) => setColsInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerateSheet();
              }}
            />
          </label>
          <label>
            Total interval (min)
            <input
              type="number"
              min={1}
              max={1440}
              value={intervalInput}
              onChange={(event) => setIntervalInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerateSheet();
              }}
            />
          </label>
        </div>
        <div className="control-row">
          <label>
            Time intervals
            <input
              type="number"
              min={1}
              value={intervalCountInput}
              onChange={(event) => {
                setIntervalCountInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerateSheet();
              }}
            />
          </label>
          <label>
            Start time (HH:MM)
            <input
              type="text"
              value={startTimeInput}
              onChange={(event) => {
                setStartTimeInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerateSheet();
              }}
              placeholder="HH:MM"
              style={{
                backgroundColor:
                  startTimeInput !== "" && !isValidTimeFormat(startTimeInput)
                    ? "#ffcccc"
                    : "",
              }}
            />
          </label>
          <button
            type="button"
            className="generate-sheet-button"
            onClick={handleGenerateSheet}
          >
            Generate sheet
          </button>
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
              value={batchSizeInput}
              onChange={handleBatchSize}
            />
          </label>
          <button
            type="button"
            className="batch-button"
            onClick={handleGenerateBatch}
          >
            Generate {batchSizeInput} printable grids
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
