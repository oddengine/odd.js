@echo off

set scripts[0]=".\release\playease.api.min.js"
set scripts[1]=".\src\utils\playease.utils.js"
set scripts[2]=".\src\utils\playease.utils.amf.js"
set scripts[3]=".\src\utils\playease.utils.bitstream.js"
set scripts[4]=".\src\utils\playease.utils.browser.js"
set scripts[5]=".\src\utils\playease.utils.crypt.js"
set scripts[6]=".\src\utils\playease.utils.css.js"
set scripts[7]=".\src\utils\playease.utils.endian.js"
set scripts[8]=".\src\utils\playease.utils.filekeeper.js"
set scripts[9]=".\src\utils\playease.utils.golomb.js"
set scripts[10]=".\src\utils\playease.utils.url.js"
set scripts[11]=".\src\utils\playease.utils.xml2json.js"
set scripts[12]=".\src\utils\mpd\playease.utils.mpd.js"
set scripts[13]=".\src\utils\mpd\playease.utils.mpd.matchers.js"
set scripts[14]=".\src\utils\mpd\playease.utils.mpd.matchers.datetime.js"
set scripts[15]=".\src\utils\mpd\playease.utils.mpd.matchers.duration.js"
set scripts[16]=".\src\utils\mpd\playease.utils.mpd.matchers.numeric.js"
set scripts[17]=".\src\utils\mpd\playease.utils.mpd.matchers.string.js"
set scripts[18]=".\src\events\playease.events.js"
set scripts[19]=".\src\events\playease.events.eventdispatcher.js"
set scripts[20]=".\src\utils\playease.utils.timer.js"
set scripts[21]=".\src\ui\playease.ui.js"
set scripts[22]=".\src\ui\components\playease.ui.components.js"
set scripts[23]=".\src\ui\components\playease.ui.components.button.js"
set scripts[24]=".\src\ui\components\playease.ui.components.label.js"
set scripts[25]=".\src\ui\components\playease.ui.components.preview.js"
set scripts[26]=".\src\ui\components\playease.ui.components.select.js"
set scripts[27]=".\src\ui\components\playease.ui.components.slider.js"
set scripts[28]=".\src\ui\components\playease.ui.components.panel.js"
set scripts[29]=".\src\ui\playease.ui.poster.js"
set scripts[30]=".\src\ui\playease.ui.danmu.js"
set scripts[31]=".\src\ui\playease.ui.display.js"
set scripts[32]=".\src\ui\playease.ui.ad.js"
set scripts[33]=".\src\ui\playease.ui.share.js"
set scripts[34]=".\src\ui\playease.ui.logo.js"
set scripts[35]=".\src\ui\playease.ui.controlbar.js"
set scripts[36]=".\src\ui\playease.ui.contextmenu.js"
set length=37

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
