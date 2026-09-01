# SOLLERS Traffic Rush

Полностью рабочий MVP мобильной браузерной top-down гонки. Игрок управляет пикапом ST9, перестраивается между полосами, собирает бонусы и проходит lead-воронку после первого демо-заезда.

## Возможности

- launch-виджет, главное меню и гараж;
- выбор мальчика/девочки и связанная с персонажем палитра автомобиля;
- игровой заезд на Phaser 3 с Canvas-рендерингом;
- свайпы, тапы, экранные кнопки и клавиатура;
- растущая скорость, трафик, бонусы `+10`, пауза и `4H BOOST`;
- сохранение рекорда и выбора в `localStorage`;
- mock lead backend: телефон, отправка кода и подтверждение;
- dev SMS-код: `1234`;
- install-воронка и PWA-ready файлы (`manifest.webmanifest`, service worker);
- автоматическая статическая сборка для GitHub Pages.

## Запуск

Требуется Node.js 22+ и pnpm.

```bash
pnpm install
pnpm dev
```

Откройте адрес, который появится в терминале.

## Production-сборка

```bash
pnpm build
pnpm start
```

Команда `pnpm start` запускает готовую статическую сборку на `http://localhost:4173`.

Vite/Vinext-сборка для Cloudflare-совместимого окружения доступна отдельно:

```bash
pnpm build:vite
```

Статическая сборка для GitHub Pages:

```bash
pnpm build:pages
```

## Структура

- `src/game/scenes` — Phaser-сцены и игровой цикл;
- `src/ui` — экраны, HUD, модальные окна и Canvas-контейнер;
- `src/state` — сохранение состояния MVP;
- `src/services` — интерфейс сервиса отправки/проверки SMS;
- `src/backend-mock` — локальное хранилище лидов;
- `src/config` — палитры и параметры игрового поля;
- `public` — PWA manifest, service worker и иконка.

Для подключения реального SMS API замените реализацию `src/services/leadService.ts`, сохранив её методы `requestCode` и `verifyCode`.
