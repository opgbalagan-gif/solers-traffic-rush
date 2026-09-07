import { assetUrl } from '@/src/config/game';

export function ControlIcon({ name, size = 24, className = '' }: {
  name: 'pointer' | 'move-horizontal' | 'pause'; size?: number; className?: string;
}) {
  // Lucide icons, ISC license: public/icons/lucide/LICENSE.txt.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`control-icon ${className}`} src={assetUrl(`/icons/lucide/${name}.svg`)} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}

export function DrivingGuide({ compact = false }: { compact?: boolean }) {
  if (compact) return <div className="control-reminders" aria-label="Управление">
    <span><ControlIcon name="move-horizontal" />Свайп — полоса</span>
    <span><ControlIcon name="pointer" />Удержание — азот</span>
  </div>;
  return <div className="gesture-guides">
    <article className="gesture-guide swipe-guide">
      <div className="gesture-picture" aria-hidden="true">
        <ControlIcon name="move-horizontal" size={90} className="swipe-arrows" />
        <ControlIcon name="pointer" size={62} className="swipe-finger" />
      </div>
      <h3>СВАЙПАЙ</h3>
      <p>Влево или вправо —<br/>сменить полосу.</p>
    </article>
    <article className="gesture-guide hold-guide">
      <div className="gesture-picture" aria-hidden="true">
        <i className="hold-ring" /><i className="hold-ring second" />
        <ControlIcon name="pointer" size={62} className="hold-finger" />
        <span className="nitro-trails"><i /><i /><i /></span>
      </div>
      <h3>УДЕРЖИВАЙ</h3>
      <p>Палец на экране — азот.<br/>Отпусти — выключится.</p>
    </article>
  </div>;
}
