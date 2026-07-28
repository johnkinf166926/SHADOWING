export function Waveform({
  values,
  label,
  tone = "reference",
}: {
  values: number[];
  label: string;
  tone?: "reference" | "recording";
}) {
  return (
    <div className={`waveform waveform-${tone}`} aria-label={label} role="img">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(8, value * 100)}%` }} />
      ))}
    </div>
  );
}
