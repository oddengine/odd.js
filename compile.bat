@echo off

set scripts[0]=".\src\odd.js"
set scripts[1]=".\src\utils\utils.js"
set scripts[2]=".\src\utils\utils.amf.js"
set scripts[3]=".\src\utils\utils.bitstream.js"
set scripts[4]=".\src\utils\utils.browser.js"
set scripts[5]=".\src\utils\utils.crypt.js"
set scripts[6]=".\src\utils\utils.css.js"
set scripts[7]=".\src\utils\utils.endian.js"
set scripts[8]=".\src\utils\utils.filesaver.js"
set scripts[9]=".\src\utils\utils.golomb.js"
set scripts[10]=".\src\utils\utils.logger.js"
set scripts[11]=".\src\utils\utils.url.js"
set scripts[12]=".\src\utils\utils.xml2json.js"
set scripts[13]=".\src\utils\mpd\mpd.js"
set scripts[14]=".\src\utils\mpd\mpd.matchers.js"
set scripts[15]=".\src\utils\mpd\mpd.matchers.datetime.js"
set scripts[16]=".\src\utils\mpd\mpd.matchers.duration.js"
set scripts[17]=".\src\utils\mpd\mpd.matchers.numeric.js"
set scripts[18]=".\src\utils\mpd\mpd.matchers.string.js"
set scripts[19]=".\src\events\events.js"
set scripts[20]=".\src\events\events.eventdispatcher.js"
set scripts[21]=".\src\utils\utils.streamsaver.js"
set scripts[22]=".\src\utils\utils.timer.js"
set scripts[23]=".\src\io\io.js"
set scripts[24]=".\src\io\io.fetch.js"
set scripts[25]=".\src\io\io.mozstream.js"
set scripts[26]=".\src\io\io.msstream.js"
set scripts[27]=".\src\io\io.websocket.js"
set scripts[28]=".\src\io\io.xhr.js"
set length=29

cd.>.\release\odd.common.js

set index=0
:loop0
if %index% equ %length% goto end0

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.common.js
)
set /a index=%index% + 1

goto loop0
:end0

set scripts[0]=".\src\nes\nes.js"
set scripts[1]=".\src\nes\nes.cpu.js"
set scripts[2]=".\src\nes\nes.cpu.opdata.js"
set scripts[3]=".\src\nes\nes.ppu.js"
set scripts[4]=".\src\nes\nes.ppu.nametable.js"
set scripts[5]=".\src\nes\nes.ppu.palettetable.js"
set scripts[6]=".\src\nes\nes.ppu.tile.js"
set scripts[7]=".\src\nes\nes.apu.js"
set scripts[8]=".\src\nes\nes.apu.channeldm.js"
set scripts[9]=".\src\nes\nes.apu.channelnoise.js"
set scripts[10]=".\src\nes\nes.apu.channelsquare.js"
set scripts[11]=".\src\nes\nes.apu.channeltriangle.js"
set scripts[12]=".\src\nes\nes.keyboard.js"
set scripts[13]=".\src\nes\nes.rom.js"
set scripts[14]=".\src\nes\mapper\mapper.js"
set scripts[15]=".\src\nes\mapper\mapper.000.js"
set scripts[16]=".\src\nes\mapper\mapper.001.js"
set scripts[17]=".\src\nes\mapper\mapper.002.js"
set scripts[18]=".\src\nes\mapper\mapper.003.js"
set scripts[19]=".\src\nes\mapper\mapper.004.js"
set scripts[20]=".\src\nes\mapper\mapper.005.js"
set scripts[21]=".\src\nes\mapper\mapper.007.js"
set scripts[22]=".\src\nes\mapper\mapper.011.js"
set scripts[23]=".\src\nes\mapper\mapper.034.js"
set scripts[24]=".\src\nes\mapper\mapper.066.js"
set length=25

cd.>.\release\odd.nes.js

set index=0
:loop1
if %index% equ %length% goto end1

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.nes.js
)
set /a index=%index% + 1

goto loop1
:end1

set scripts[0]=".\src\nes\ui\ui.js"
set scripts[1]=".\src\nes\ui\components\components.js"
set scripts[2]=".\src\nes\ui\components\components.button.js"
set scripts[3]=".\src\nes\ui\components\components.joystick.js"
set scripts[4]=".\src\nes\ui\components\components.label.js"
set scripts[5]=".\src\nes\ui\ui.controlbar.js"
set length=6

cd.>.\release\odd.nes.ui.js

set index=0
:loop2
if %index% equ %length% goto end2

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.nes.ui.js
)
set /a index=%index% + 1

goto loop2
:end2

set scripts[0]=".\src\im\im.js"
set scripts[1]=".\src\im\message\message.js"
set scripts[2]=".\src\im\message\message.abort.js"
set scripts[3]=".\src\im\message\message.ackwindowsize.js"
set scripts[4]=".\src\im\message\message.ack.js"
set scripts[5]=".\src\im\message\message.command.js"
set scripts[6]=".\src\im\im.state.js"
set scripts[7]=".\src\im\im.responder.js"
set scripts[8]=".\src\im\im.netconnection.js"
set scripts[9]=".\src\im\im.netstream.js"
set length=10

cd.>.\release\odd.im.js

set index=0
:loop3
if %index% equ %length% goto end3

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.im.js
)
set /a index=%index% + 1

goto loop3
:end3

set scripts[0]=".\src\im\ui\ui.js"
set scripts[1]=".\src\im\ui\components\components.js"
set scripts[2]=".\src\im\ui\components\components.button.js"
set scripts[3]=".\src\im\ui\components\components.dialog.js"
set scripts[4]=".\src\im\ui\components\components.label.js"
set scripts[5]=".\src\im\ui\components\components.panel.js"
set scripts[6]=".\src\im\ui\components\components.select.js"
set scripts[7]=".\src\im\ui\components\components.slider.js"
set scripts[8]=".\src\im\ui\components\components.tab.js"
set scripts[9]=".\src\im\ui\ui.messages.js"
set scripts[10]=".\src\im\ui\ui.contacts.js"
set scripts[11]=".\src\im\ui\ui.settings.js"
set length=12

cd.>.\release\odd.im.ui.js

set index=0
:loop4
if %index% equ %length% goto end4

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.im.ui.js
)
set /a index=%index% + 1

goto loop4
:end4

set scripts[0]=".\src\rtc\rtc.js"
set scripts[1]=".\src\rtc\rtc.constraints.js"
set scripts[2]=".\src\rtc\rtc.stats.js"
set scripts[3]=".\src\rtc\rtc.audiometer.js"
set scripts[4]=".\src\rtc\rtc.beauty.js"
set scripts[5]=".\src\rtc\rtc.beauty.shader.js"
set scripts[6]=".\src\rtc\rtc.mixer.js"
set scripts[7]=".\src\rtc\rtc.audiomixer.js"
set scripts[8]=".\src\rtc\rtc.videomixer.js"
set scripts[9]=".\src\rtc\rtc.netstream.js"
set length=10

cd.>.\release\odd.rtc.js

set index=0
:loop5
if %index% equ %length% goto end5

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.rtc.js
)
set /a index=%index% + 1

goto loop5
:end5

set scripts[0]=".\src\player\av\av.js"
set scripts[1]=".\src\player\av\codec\codec.js"
set scripts[2]=".\src\player\av\codec\codec.aac.js"
set scripts[3]=".\src\player\av\codec\codec.avc.js"
set scripts[4]=".\src\player\av\codec\codec.avc.sps.js"
set scripts[5]=".\src\player\av\codec\codec.avc.pps.js"
set scripts[6]=".\src\player\av\format\format.js"
set scripts[7]=".\src\player\av\format\format.flv.js"
set scripts[8]=".\src\player\av\format\format.fmp4.js"
set scripts[9]=".\src\player\module\module.js"
set scripts[10]=".\src\player\module\module.src.js"
set scripts[11]=".\src\player\module\module.flv.js"
set scripts[12]=".\src\player\module\module.fmp4.js"
set scripts[13]=".\src\player\module\module.rtc.js"
set scripts[14]=".\src\player\player.js"
set scripts[15]=".\src\player\player.model.js"
set scripts[16]=".\src\player\player.view.js"
set scripts[17]=".\src\player\player.controller.js"
set length=18

cd.>.\release\odd.player.js

set index=0
:loop6
if %index% equ %length% goto end6

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.player.js
)
set /a index=%index% + 1

goto loop6
:end6

set scripts[0]=".\src\player\ui\ui.js"
set scripts[1]=".\src\player\ui\components\components.js"
set scripts[2]=".\src\player\ui\components\components.button.js"
set scripts[3]=".\src\player\ui\components\components.label.js"
set scripts[4]=".\src\player\ui\components\components.preview.js"
set scripts[5]=".\src\player\ui\components\components.select.js"
set scripts[6]=".\src\player\ui\components\components.slider.js"
set scripts[7]=".\src\player\ui\components\components.panel.js"
set scripts[8]=".\src\player\ui\components\components.settings.js"
set scripts[9]=".\src\player\ui\ui.poster.js"
set scripts[10]=".\src\player\ui\ui.chat.js"
set scripts[11]=".\src\player\ui\ui.danmu.js"
set scripts[12]=".\src\player\ui\ui.display.js"
set scripts[13]=".\src\player\ui\ui.ad.js"
set scripts[14]=".\src\player\ui\ui.share.js"
set scripts[15]=".\src\player\ui\ui.logo.js"
set scripts[16]=".\src\player\ui\ui.controlbar.js"
set scripts[17]=".\src\player\ui\ui.contextmenu.js"
set length=18

cd.>.\release\odd.player.ui.js

set index=0
:loop7
if %index% equ %length% goto end7

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.player.ui.js
)
set /a index=%index% + 1

goto loop7
:end7

set scripts[0]=".\release\odd.common.js"
set scripts[1]=".\release\odd.im.js"
set scripts[2]=".\release\odd.im.ui.js"
set scripts[3]=".\release\odd.rtc.js"
set scripts[4]=".\release\odd.player.js"
set scripts[5]=".\release\odd.player.ui.js"
set length=6

cd.>.\release\odd.js

set index=0
:loop8
if %index% equ %length% goto end8

for /f "usebackq delims== tokens=1-7" %%i in (`set scripts[%index%]`) do (
    echo %%j
    type %%j >> .\release\odd.js
)
set /a index=%index% + 1

goto loop8
:end8

terser .\\release\\odd.common.js -c -m --warn -o .\\release\\odd.common.min.js
terser .\\release\\odd.im.js -c -m --warn -o .\\release\\odd.im.min.js
terser .\\release\\odd.im.ui.js -c -m --warn -o .\\release\\odd.im.ui.min.js
terser .\\release\\odd.rtc.js -c -m --warn -o .\\release\\odd.rtc.min.js
terser .\\release\\odd.player.js -c -m --warn -o .\\release\\odd.player.min.js
terser .\\release\\odd.player.ui.js -c -m --warn -o .\\release\\odd.player.ui.min.js
terser .\\release\\odd.js -c -m --warn -o .\\release\\odd.min.js
