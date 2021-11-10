@echo off

set scripts[0]=".\release\playease.api.min.js"
set scripts[1]=".\src\ui\playease.ui.js"
set scripts[2]=".\src\ui\components\playease.ui.components.js"
set scripts[3]=".\src\ui\components\playease.ui.components.button.js"
set scripts[4]=".\src\ui\components\playease.ui.components.label.js"
set scripts[5]=".\src\ui\components\playease.ui.components.preview.js"
set scripts[6]=".\src\ui\components\playease.ui.components.select.js"
set scripts[7]=".\src\ui\components\playease.ui.components.slider.js"
set scripts[8]=".\src\ui\components\playease.ui.components.panel.js"
set scripts[9]=".\src\ui\playease.ui.poster.js"
set scripts[10]=".\src\ui\playease.ui.danmu.js"
set scripts[11]=".\src\ui\playease.ui.display.js"
set scripts[12]=".\src\ui\playease.ui.ad.js"
set scripts[13]=".\src\ui\playease.ui.share.js"
set scripts[14]=".\src\ui\playease.ui.logo.js"
set scripts[15]=".\src\ui\playease.ui.controlbar.js"
set scripts[16]=".\src\ui\playease.ui.contextmenu.js"
set length=17

cd.>.\release\playease.js

set index=0
:loop
if %index% equ %length% goto end

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\playease.js
)
set /a index=%index% + 1

goto loop
:end

uglifyjs .\\release\\playease.js -c -m --warn -o .\\release\\playease.min.js
