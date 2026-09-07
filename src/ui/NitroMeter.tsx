export function NitroMeter({ charge, active }: { charge: number; active: boolean }) {
  const level = Math.round(Math.max(0, Math.min(100, charge)));
  const state = active ? 'Ускорение' : level === 100 ? 'Готов' : 'Восстанавливается';
  return <div className={`nitro-meter ${active ? 'active' : level < 25 ? 'low' : ''}`}
    role="meter" aria-label="Запас азота" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={level} aria-valuetext={`${level}%. ${state}`}>
    <div className="nitro-meter-label" aria-hidden="true"><span>АЗОТ</span><b>{level}<small>%</small></b></div>
    <div className="nitro-meter-track" aria-hidden="true"><i style={{ transform: `scaleX(${level / 100})` }}/></div>
  </div>;
}
