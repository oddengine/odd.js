#!/bin/sh

scripts=()
scripts[0]="./src/odd.js"
scripts[1]="./src/utils/utils.js"
scripts[2]="./src/utils/utils.amf.js"
scripts[3]="./src/utils/utils.bitstream.js"
scripts[4]="./src/utils/utils.browser.js"
scripts[5]="./src/utils/utils.crypt.js"
scripts[6]="./src/utils/utils.css.js"
scripts[7]="./src/utils/utils.endian.js"
scripts[8]="./src/utils/utils.filesaver.js"
scripts[9]="./src/utils/utils.golomb.js"
scripts[10]="./src/utils/utils.logger.js"
scripts[11]="./src/utils/utils.url.js"
scripts[12]="./src/utils/utils.xml2json.js"
scripts[13]="./src/utils/mpd/mpd.js"
scripts[14]="./src/utils/mpd/mpd.matchers.js"
scripts[15]="./src/utils/mpd/mpd.matchers.datetime.js"
scripts[16]="./src/utils/mpd/mpd.matchers.duration.js"
scripts[17]="./src/utils/mpd/mpd.matchers.numeric.js"
scripts[18]="./src/utils/mpd/mpd.matchers.string.js"
scripts[19]="./src/events/events.js"
scripts[20]="./src/events/events.eventdispatcher.js"
scripts[21]="./src/utils/utils.streamsaver.js"
scripts[22]="./src/utils/utils.timer.js"
scripts[23]="./src/io/io.js"
scripts[24]="./src/io/io.fetch.js"
scripts[25]="./src/io/io.mozstream.js"
scripts[26]="./src/io/io.msstream.js"
scripts[27]="./src/io/io.websocket.js"
scripts[28]="./src/io/io.xhr.js"

:>./release/odd.common.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.common.js
done

scripts=()
scripts[0]="./src/nes/nes.js"
scripts[1]="./src/nes/nes.cpu.js"
scripts[2]="./src/nes/nes.cpu.opdata.js"
scripts[3]="./src/nes/nes.ppu.js"
scripts[4]="./src/nes/nes.ppu.nametable.js"
scripts[5]="./src/nes/nes.ppu.palettetable.js"
scripts[6]="./src/nes/nes.ppu.tile.js"
scripts[7]="./src/nes/nes.apu.js"
scripts[8]="./src/nes/nes.apu.channeldm.js"
scripts[9]="./src/nes/nes.apu.channelnoise.js"
scripts[10]="./src/nes/nes.apu.channelsquare.js"
scripts[11]="./src/nes/nes.apu.channeltriangle.js"
scripts[12]="./src/nes/nes.keyboard.js"
scripts[13]="./src/nes/nes.rom.js"
scripts[14]="./src/nes/mapper/mapper.js"
scripts[15]="./src/nes/mapper/mapper.000.js"
scripts[16]="./src/nes/mapper/mapper.001.js"
scripts[17]="./src/nes/mapper/mapper.002.js"
scripts[18]="./src/nes/mapper/mapper.003.js"
scripts[19]="./src/nes/mapper/mapper.004.js"
scripts[20]="./src/nes/mapper/mapper.005.js"
scripts[21]="./src/nes/mapper/mapper.007.js"
scripts[22]="./src/nes/mapper/mapper.011.js"
scripts[23]="./src/nes/mapper/mapper.034.js"
scripts[24]="./src/nes/mapper/mapper.066.js"

:>./release/odd.nes.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.nes.js
done

scripts=()
scripts[0]="./src/nes/ui/ui.js"
scripts[1]="./src/nes/ui/components/components.js"
scripts[2]="./src/nes/ui/components/components.button.js"
scripts[3]="./src/nes/ui/components/components.joystick.js"
scripts[4]="./src/nes/ui/components/components.label.js"
scripts[5]="./src/nes/ui/ui.controlbar.js"

:>./release/odd.nes.ui.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.nes.ui.js
done

scripts=()
scripts[0]="./src/im/im.js"
scripts[1]="./src/im/message/message.js"
scripts[2]="./src/im/message/message.abort.js"
scripts[3]="./src/im/message/message.ackwindowsize.js"
scripts[4]="./src/im/message/message.ack.js"
scripts[5]="./src/im/message/message.command.js"
scripts[6]="./src/im/im.state.js"
scripts[7]="./src/im/im.responder.js"
scripts[8]="./src/im/im.netconnection.js"
scripts[9]="./src/im/im.netstream.js"

:>./release/odd.im.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.im.js
done

scripts=()
scripts[0]="./src/im/ui/ui.js"
scripts[1]="./src/im/ui/components/components.js"
scripts[2]="./src/im/ui/components/components.button.js"
scripts[3]="./src/im/ui/components/components.dialog.js"
scripts[4]="./src/im/ui/components/components.label.js"
scripts[5]="./src/im/ui/components/components.panel.js"
scripts[6]="./src/im/ui/components/components.select.js"
scripts[7]="./src/im/ui/components/components.slider.js"
scripts[8]="./src/im/ui/components/components.tab.js"
scripts[9]="./src/im/ui/ui.messages.js"
scripts[10]="./src/im/ui/ui.contacts.js"
scripts[11]="./src/im/ui/ui.settings.js"

:>./release/odd.im.ui.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.im.ui.js
done

scripts=()
scripts[0]="./src/rtc/rtc.js"
scripts[1]="./src/rtc/rtc.constraints.js"
scripts[2]="./src/rtc/rtc.stats.js"
scripts[3]="./src/rtc/rtc.audiometer.js"
scripts[4]="./src/rtc/rtc.beauty.js"
scripts[5]="./src/rtc/rtc.beauty.shader.js"
scripts[6]="./src/rtc/rtc.mixer.js"
scripts[7]="./src/rtc/rtc.audiomixer.js"
scripts[8]="./src/rtc/rtc.videomixer.js"
scripts[9]="./src/rtc/rtc.netstream.js"

:>./release/odd.rtc.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.rtc.js
done

scripts=()
scripts[0]="./src/player/av/av.js"
scripts[1]="./src/player/av/codec/codec.js"
scripts[2]="./src/player/av/codec/codec.aac.js"
scripts[3]="./src/player/av/codec/codec.avc.js"
scripts[4]="./src/player/av/codec/codec.avc.sps.js"
scripts[5]="./src/player/av/codec/codec.avc.pps.js"
scripts[6]="./src/player/av/format/format.js"
scripts[7]="./src/player/av/format/format.flv.js"
scripts[8]="./src/player/av/format/format.fmp4.js"
scripts[9]="./src/player/module/module.js"
scripts[10]="./src/player/module/module.src.js"
scripts[11]="./src/player/module/module.flv.js"
scripts[12]="./src/player/module/module.fmp4.js"
scripts[13]="./src/player/module/module.rtc.js"
scripts[14]="./src/player/player.js"
scripts[15]="./src/player/player.model.js"
scripts[16]="./src/player/player.view.js"
scripts[17]="./src/player/player.controller.js"

:>./release/odd.player.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.player.js
done

scripts=()
scripts[0]="./src/player/ui/ui.js"
scripts[1]="./src/player/ui/components/components.js"
scripts[2]="./src/player/ui/components/components.button.js"
scripts[3]="./src/player/ui/components/components.label.js"
scripts[4]="./src/player/ui/components/components.preview.js"
scripts[5]="./src/player/ui/components/components.select.js"
scripts[6]="./src/player/ui/components/components.slider.js"
scripts[7]="./src/player/ui/components/components.panel.js"
scripts[8]="./src/player/ui/components/components.settings.js"
scripts[9]="./src/player/ui/ui.poster.js"
scripts[10]="./src/player/ui/ui.chat.js"
scripts[11]="./src/player/ui/ui.danmu.js"
scripts[12]="./src/player/ui/ui.display.js"
scripts[13]="./src/player/ui/ui.ad.js"
scripts[14]="./src/player/ui/ui.share.js"
scripts[15]="./src/player/ui/ui.logo.js"
scripts[16]="./src/player/ui/ui.controlbar.js"
scripts[17]="./src/player/ui/ui.contextmenu.js"

:>./release/odd.player.ui.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.player.ui.js
done

scripts=()
scripts[0]="./release/odd.common.js"
scripts[1]="./release/odd.nes.js"
scripts[2]="./release/odd.nes.ui.js"
scripts[3]="./release/odd.im.js"
scripts[4]="./release/odd.im.ui.js"
scripts[5]="./release/odd.rtc.js"
scripts[6]="./release/odd.player.js"
scripts[7]="./release/odd.player.ui.js"

:>./release/odd.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/odd.js
done

terser ./release/odd.common.js -c -m --warn -o ./release/odd.common.min.js
terser ./release/odd.nes.js -c -m --warn -o ./release/odd.nes.min.js
terser ./release/odd.nes.ui.js -c -m --warn -o ./release/odd.nes.ui.min.js
terser ./release/odd.im.js -c -m --warn -o ./release/odd.im.min.js
terser ./release/odd.im.ui.js -c -m --warn -o ./release/odd.im.ui.min.js
terser ./release/odd.rtc.js -c -m --warn -o ./release/odd.rtc.min.js
terser ./release/odd.player.js -c -m --warn -o ./release/odd.player.min.js
terser ./release/odd.player.ui.js -c -m --warn -o ./release/odd.player.ui.min.js
terser ./release/odd.js -c -m --warn -o ./release/odd.min.js
