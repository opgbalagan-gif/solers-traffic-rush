# Графика

## Пользовательские материалы
- public/art/concept-black.png — неизменённый файл «ChatGPT Image 2 сент. 2026 г., 01_01_28.png».
- public/art/concept-pink.png — неизменённый файл «ChatGPT Image 2 сент. 2026 г., 01_01_23.png».
- Компонент ConceptArt показывает отдельные области исходных листов через CSS-окна. Надписи и кнопки интерфейса остаются рабочими HTML-элементами.
- Справочная страница модели: https://sollers-avilon.ru/models/st9/
- Изменение цвета предпросмотра и игрового спрайта выполняется фильтром при отображении; исходные PNG не изменяются.

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
