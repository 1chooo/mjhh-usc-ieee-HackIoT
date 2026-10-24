import { energyDeltaLabel, type ThermalResult } from "../lib/thermal";

export function ResultBlock({ result }: { result: ThermalResult }) {
  const savedClass =
    result.savedKwh > 0.005 ? "save" : result.savedKwh < -0.005 ? "spend" : "";

  return (
    <div className="result">
      <p className={`badge ${result.action}`}>{result.action}</p>
      <dl className="stat-grid">
        <div>
          <dt>Feels like</dt>
          <dd>{result.perceivedC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Setpoint</dt>
          <dd>{result.targetC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Fixed</dt>
          <dd>{result.baselineSetpointC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd className={savedClass}>{energyDeltaLabel(result.savedKwh)}</dd>
        </div>
      </dl>
      <EnergyCompare
        baselineKwh={result.baselineKwh}
        adaptiveKwh={result.adaptiveKwh}
      />
    </div>
  );
}

export function EnergyCompare({
  baselineKwh,
  adaptiveKwh,
}: {
  baselineKwh: number;
  adaptiveKwh: number;
}) {
  const max = Math.max(baselineKwh, adaptiveKwh, 0.001);
  return (
    <div className="energy" aria-hidden="true">
      <div>
        <span>Fixed</span>
        <span className="bar">
          <span style={{ width: `${(baselineKwh / max) * 100}%` }} />
        </span>
        <strong>{baselineKwh.toFixed(2)}</strong>
      </div>
      <div>
        <span>Policy</span>
        <span className="bar">
          <span
            className="policy"
            style={{ width: `${(adaptiveKwh / max) * 100}%` }}
          />
        </span>
        <strong>{adaptiveKwh.toFixed(2)}</strong>
      </div>
    </div>
  );
}

export function VoteMeter({ hot, cold }: { hot: number; cold: number }) {
  const total = hot + cold;
  const hotPct = total === 0 ? 0 : (hot / total) * 100;
  const coldPct = total === 0 ? 0 : (cold / total) * 100;
  return (
    <div className="votes">
      <div className="meter" aria-hidden="true">
        <span className="hot" style={{ width: `${hotPct}%` }} />
        <span className="cold" style={{ width: `${coldPct}%` }} />
      </div>
      <p>
        {Math.round(hot)} hot · {Math.round(cold)} cold
      </p>
    </div>
  );
}
