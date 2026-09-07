# Графика

## Иконки управления
`public/icons/lucide/` содержит оригинальные SVG `pointer`, `move-horizontal` и `pause` из [Lucide](https://github.com/lucide-icons/lucide). Лицензия сохранена рядом в `LICENSE.txt`. В подсказке жестов иконки анимируются средствами CSS; при уменьшенном движении анимация отключается. Фон подсказки — сама загруженная игровая сцена с остановленной симуляцией.

## Пользовательские материалы
- public/art/concept-black.png — неизменённый файл «ChatGPT Image 2 сент. 2026 г., 01_01_28.png».
- public/art/concept-pink.png — неизменённый файл «ChatGPT Image 2 сент. 2026 г., 01_01_23.png».
- Компонент ConceptArt показывает портреты водителей из исходных листов. Логотип и название игры — отдельные масштабируемые надписи; изображения меню больше не вырезаются из общего макета.
- Справочная страница модели: https://sollers-avilon.ru/models/st9/
- В меню и гараже используется `public/art/st9-dealer.png` — исходное изображение реального ST9 размером 1148×764 с прозрачностью, с [сайта дилера](https://sollers-avilon.ru/wp-content/uploads/2023/08/avilon-sollers_st9.png). Оно показывается целиком, без маски по краям.
- Цвет кузова в предпросмотре и на трассе рассчитывается общей функцией `repaintBody` по пикселям окрашенных панелей. Она сохраняет освещение, альфа-канал, нейтральные материалы и красные фонари; Canvas/CSS-фильтры для окраски не используются. Исходные PNG не изменяются.

## Игровой атлас
Файл: public/art/traffic-atlas.png. Built-in ImageGen, RGBA 1536×1024. Выбран первый результат; остальные варианты не включены.
Прозрачные поля и тени сохранены. Размеры кадров заданы в src/game/scenes/TrafficScene.ts, в том числе с учётом небольшого пересечения грузовиком границы условной сетки.

Промпт выбранного результата:

> Use case: stylized-concept. Asset type: a single production sprite atlas for a polished browser traffic racing game.
> Create ONE landscape PNG image, exactly 1536 × 1024 pixels, with a genuinely transparent RGBA background. Eight isolated game sprites in an EXACT regular 4-column by 2-row layout. Each invisible cell is 384 × 512 pixels. Cell centers are at x=192,576,960,1344 and y=256,768. Keep every sprite entirely inside its cell, generously padded on every side, no overlaps. Objects occupy about 65–75% of their cell width and 65–75% of their cell height. Align their centers and bottom baselines consistently in each row.
>
> Style: premium mobile racing-game 3D renders, medium realistic proportions, clean readable silhouettes, detailed metal and glass materials, glossy paint, realistic highlights. The camera is centered HIGH DIRECTLY BEHIND the vehicles looking downward at about 55 degrees, so roofs, rear windows and REAR ends are visible, like an elevated chase camera in a vertical traffic racing game. Every vehicle drives straight UP the image, away from viewer. Vehicle longitudinal axes exactly vertical; left-right symmetric projection, NO side rotation, NO isometric yaw, NO front views. Use the same camera angle for all vehicles. Black hero pickup is robust modern SOLLERS ST9 double-cab pickup with squared body, clearly open cargo bed between rear cab and tailgate, rear bumper and red taillights. Slight foreshortening, showing much of roof and bed as well as rear tailgate.
>
> Exactly these eight subjects, one per cell, reading left to right. TOP ROW: 1. Glossy BLACK SOLLERS ST9 double-cab pickup, open cargo bed, tailgate branding "SOLLERS" spelled S O L L E R S in small silver letters. 2. The IDENTICAL SOLLERS ST9 pickup model, proportions and pose but glossy PINK paint, open cargo bed, same silver "SOLLERS" tailgate branding. 3. Compact vivid BLUE hatchback, rear and roof visible. 4. Compact sunny YELLOW hatchback, rear and roof visible. BOTTOM ROW: 5. Bright RED four-door sedan, rear and roof visible. 6. Pearl WHITE compact SUV, rear and roof visible. 7. BLUE cargo box truck: blue cab pointing UP, tall rectangular blue cargo box with a light grey roof, closed blue rear double doors facing viewer, rear red lamps. 8. One leafy low-poly roadside TREE, green clustered canopy and visible brown trunk, same elevated camera angle, entire canopy and trunk visible.
>
> Lighting: softly directional daylight from upper left, attractive material highlights, compact subtle semitransparent grounding shadow beneath each object only. Shadows must not bleed into adjacent cells. Background must be alpha transparency, NOT white, NOT black, NOT a painted checkerboard. No road, UI, scenery, labels, cell borders, grid lines, watermark, extra objects, extra vehicles, smoke, motion trails or text other than the tiny SOLLERS pickup tailgate markings. Entire objects must be visible.

## Дополнительное окружение
Файл: public/art/scenery-atlas.png. Built-in ImageGen, один запрос, PNG RGBA 1536×1024; 55,13% пикселей полностью прозрачны. Новые виды деревьев, дом, склад, брендированный щит, камни и ящик. Границы кадров заданы в TrafficScene; исходное изображение не редактировалось.

Промпт:

> Use case: stylized-concept. Asset type: production game sprite atlas for the SOLLERS ST9 browser racing game. Create ONE 1536 x 1024 pixel PNG RGBA sprite atlas with a genuinely transparent background (actual zero-alpha empty pixels, never a painted checkerboard). It is a precisely aligned 4-column x 2-row atlas, each cell exactly 384 x 512 pixels. Do not draw the cell boundaries, grid lines, labels, canvas background, ground plane, road, UI, decorative extra objects, or watermark.
>
> Camera and art direction: medium-realistic premium mobile 3D racing game graphics. All eight isolated objects share the same elevated racing chase-camera perspective: camera high directly behind the player looking down at the objects at 55 degrees. Crisp realistic materials, cohesive proportions and sharp readable silhouettes. Sun from the upper left. Only subtle tight contact shadows, no broad ground shadows, no ground patches.
>
> Layout is exact. Columns occupy x=0..383,384..767,768..1151,1152..1535. Top row y=0..511, bottom row y=512..1023. Every object, all its branches and any tight shadow must remain completely inside its own cell with at least 30 px completely transparent margins on all four sides. Each object should occupy approximately 70% of its cell width and 70% of its cell height while preserving a natural recognizable shape. Exact object centers: x=192,576,960,1344; y=256 for row 1, y=768 for row 2. No overlapping or touching neighboring cells.
>
> ROW 1, left to right: Cell 1 centered (192,256): one green tall spruce pine tree, richly layered natural green needles and visible short trunk. Cell 2 centered (576,256): one golden orange autumn birch tree with a slender pale birch trunk. Cell 3 centered (960,256): one snow-dusted tall evergreen spruce, green foliage naturally dusted with white snow. Cell 4 centered (1344,256): one compact cream rural cottage with a red roof; isolated yard-free building silhouette, no fence, landscaping or extra objects.
>
> ROW 2, left to right: Cell 5 centered (192,768): one black roadside billboard on two metal posts. The front of the billboard faces the camera and is clearly readable from this elevated perspective. Verbatim branding text: large white "SOLLERS", spelled S O L L E R S; smaller orange "ST9". No other text. Cell 6 centered (576,768): one small grey corrugated-metal roadside warehouse with a simple industrial silhouette. Cell 7 centered (960,768): one small pine bush / rounded rocks cluster, compact cohesive single scenery sprite. Cell 8 centered (1344,768): one wooden collectible cargo crate, with dark diagonal straps and a green luminous badge.
>
> These eight sprites will appear beside a road in a racing game. Deliver exactly this single atlas, with true transparent negative space between sprites and around the outer edges.
