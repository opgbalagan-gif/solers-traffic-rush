import { useEffect, useRef } from 'react';
import { assetUrl } from '@/src/config/game';
import { repaintBody } from '@/src/game/paint';

// Display selected regions of the original, unmodified user-supplied concept sheets.
export function ConceptArt({ pink = false, crop, className = '', label, filter }: {
  pink?: boolean; crop: [number, number, number, number]; className?: string; label: string; filter?: string;
}) {
  const [x, y, w, h] = crop;
  const width = pink ? 1254 : 1216;
  const height = pink ? 1254 : 1294;
  return <div className={`concept-art ${className}`} role="img" aria-label={label} style={{ aspectRatio: `${w}/${h}`, filter }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img draggable={false} alt="" src={assetUrl(`/art/concept-${pink ? 'pink' : 'black'}.png`)} style={{ width: `${width / w * 100}%`, height: `${height / h * 100}%`, left: `${-x / w * 100}%`, top: `${-y / h * 100}%` }} />
  </div>;
}
export function GameLogo({ small = false }: { small?: boolean }) {
  return <div className={`game-logo ${small ? 'small' : ''}`} aria-label="SOLLERS Traffic Rush"><strong>SOLLERS</strong><span>TRAFFIC RUSH</span></div>;
}
export function DriverAvatar({ driver }: { driver: 'boy' | 'girl' }) {
  return <ConceptArt crop={driver === 'boy' ? [461, 143, 145, 260] : [633, 147, 133, 258]} className="driver-avatar" label={driver === 'boy' ? 'Водитель в чёрном худи SOLLERS' : 'Водитель в кепке SOLLERS'} />;
}
export function VehiclePreview({ color, hero = false }: { color: string; hero?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      repaintBody(pixels.data, color, 'blue');
      context.putImageData(pixels, 0, 0);
    };
    image.src = assetUrl('/art/st9-dealer.png');
    return () => { cancelled = true; };
  }, [color]);
  return <canvas ref={canvasRef} width={1148} height={764} role="img" aria-label="Пикап SOLLERS ST9 в выбранном цвете" className={`vehicle-render ${hero ? 'hero-art' : 'vehicle-preview'}`} />;
}
export function Icon({ name, size = 24 }: { name: 'settings' | 'back' | 'close' | 'trophy' | 'garage' | 'tasks' | 'pause' | 'sound' | 'mute'; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    back: <path d="m14 6-6 6 6 6M8 12h12" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
    trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6m-4 1h8" /></>,
    garage: <path d="m3 9 9-6 9 6v12H3V9Zm4 12V11h10v10M7 14h10M7 17h10" />,
    tasks: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 3v4m6-4v4M8 12h8m-8 4h5" /></>,
    settings: <><path d="m10 3-1 3-3 1-3 3 2 2-1 3 3 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2V6l-3-2-3 1-2-2Z" /><circle cx="12" cy="11" r="3" /></>,
    sound: <path d="M4 9h4l5-4v14l-5-4H4V9Zm12-2c4 3 4 7 0 10" />,
    mute: <path d="M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
