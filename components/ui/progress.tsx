export function Progress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <span className="progress-fill" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
