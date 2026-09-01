import type { CSSProperties } from 'react';
import type { Driver } from '@/src/state/store';

export function GameLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`game-logo ${compact ? 'compact' : ''}`} aria-label="SOLLERS Traffic Rush">
      <strong>SOLLERS</strong>
      <span>TRAFFIC RUSH</span>
    </div>
  );
}

export function VehiclePreview({ color, small = false }: { color: string; small?: boolean }) {
  return (
    <div className={`vehicle-preview ${small ? 'small' : ''}`} style={{ '--car-color': color } as CSSProperties} aria-label="Пикап ST9">
      <div className="truck-shadow" />
      <div className="truck-wheel wheel-a" />
      <div className="truck-wheel wheel-b" />
      <div className="truck-wheel wheel-c" />
      <div className="truck-wheel wheel-d" />
      <div className="truck-body">
        <div className="truck-hood"><span /><span /></div>
        <div className="truck-cab"><i /><b /></div>
        <div className="truck-bed"><span /></div>
        <em>SOLLERS</em>
      </div>
    </div>
  );
}

export function DriverAvatar({ driver }: { driver: Driver }) {
  return (
    <div className={`driver-avatar ${driver}`} aria-label={driver === 'boy' ? 'Водитель мальчик' : 'Водитель девочка'}>
      <div className="avatar-hair" />
      <div className="avatar-head">
        <span className="eye eye-left" />
        <span className="eye eye-right" />
        <span className="avatar-smile" />
      </div>
      <div className="avatar-body"><b>SOLLERS</b></div>
      <div className="avatar-legs"><span /><span /></div>
      {driver === 'girl' && <div className="avatar-cap">S</div>}
    </div>
  );
}
