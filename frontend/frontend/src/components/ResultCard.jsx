export default function ResultCard({ data }) {
  const stageColor = data.stage === "Larva" ? "#f59e0b" : "#ef4444";
  const confColor  = data.confidence > 80 ? "#16a34a" : data.confidence > 50 ? "#d97706" : "#dc2626";

  return (
    <div className="result-card">
      <div className="result-row">
        <span className="pest-name">{data.pest_name}</span>
        <span className="pest-stage" style={{ background: stageColor }}>
          {data.stage}
        </span>
      </div>
      <div className="result-row">
        <span className="conf-label">Confidence</span>
        <span className="conf-value" style={{ color: confColor }}>
          {data.confidence}%
        </span>
      </div>
      <div className="conf-bar-track">
        <div className="conf-bar-fill" style={{ width: `${data.confidence}%`, background: confColor }} />
      </div>
    </div>
  );
}