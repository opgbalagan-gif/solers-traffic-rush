export const GAME_WIDTH = 430;
export const GAME_HEIGHT = 780;
export const ROAD_LEFT = 42;
export const ROAD_RIGHT = 388;
export const LANE_X = [101, 215, 329];

export const BOY_COLORS = [
  { name: 'Чёрный', value: '#10161d' },
  { name: 'Белый', value: '#e8edf0' },
  { name: 'Красный', value: '#b91f31' },
  { name: 'Синий', value: '#1748a3' },
  { name: 'Серый', value: '#7f8b94' },
  { name: 'Хаки', value: '#687446' },
];

export const GIRL_COLORS = [
  { name: 'Розовый', value: '#ee5b9e' },
  { name: 'Ярко-розовый', value: '#e91670' },
  { name: 'Светло-розовый', value: '#f3a9d0' },
  { name: 'Сиреневый', value: '#b483dd' },
  { name: 'Мятный', value: '#76dac7' },
  { name: 'Голубой', value: '#7ebce8' },
  { name: 'Персиковый', value: '#f58b72' },
  { name: 'Белый', value: '#edf0f2' },
];

export const STORAGE_KEY = 'sollers-traffic-rush-state-v2';
export const LEADS_KEY = 'sollers-traffic-rush-leads';

export const assetUrl = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || (process.env.GITHUB_ACTIONS === 'true' ? '/solers-traffic-rush' : '')}${path}`;
