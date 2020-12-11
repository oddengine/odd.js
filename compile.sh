#!/bin/sh

scripts=()
scripts[0]="./release/playease.api.min.js"
scripts[1]="./src/utils/playease.utils.js"
scripts[2]="./src/utils/playease.utils.amf.js"
scripts[3]="./src/utils/playease.utils.bitstream.js"
scripts[4]="./src/utils/playease.utils.browser.js"
scripts[5]="./src/utils/playease.utils.crypt.js"
scripts[6]="./src/utils/playease.utils.css.js"
scripts[7]="./src/utils/playease.utils.endian.js"
scripts[8]="./src/utils/playease.utils.filesaver.js"
scripts[9]="./src/utils/playease.utils.golomb.js"
scripts[10]="./src/utils/playease.utils.url.js"
scripts[11]="./src/utils/playease.utils.xml2json.js"
scripts[12]="./src/utils/mpd/playease.utils.mpd.js"
scripts[13]="./src/utils/mpd/playease.utils.mpd.matchers.js"
scripts[14]="./src/utils/mpd/playease.utils.mpd.matchers.datetime.js"
scripts[15]="./src/utils/mpd/playease.utils.mpd.matchers.duration.js"
scripts[16]="./src/utils/mpd/playease.utils.mpd.matchers.numeric.js"
scripts[17]="./src/utils/mpd/playease.utils.mpd.matchers.string.js"
scripts[18]="./src/events/playease.events.js"
scripts[19]="./src/events/playease.events.eventdispatcher.js"
scripts[20]="./src/utils/playease.utils.streamsaver.js"
scripts[21]="./src/utils/playease.utils.timer.js"
scripts[22]="./src/ui/playease.ui.js"
scripts[23]="./src/ui/components/playease.ui.components.js"
scripts[24]="./src/ui/components/playease.ui.components.button.js"
scripts[25]="./src/ui/components/playease.ui.components.label.js"
scripts[26]="./src/ui/components/playease.ui.components.preview.js"
scripts[27]="./src/ui/components/playease.ui.components.select.js"
scripts[28]="./src/ui/components/playease.ui.components.slider.js"
scripts[29]="./src/ui/components/playease.ui.components.panel.js"
scripts[30]="./src/ui/playease.ui.poster.js"
scripts[31]="./src/ui/playease.ui.danmu.js"
scripts[32]="./src/ui/playease.ui.display.js"
scripts[33]="./src/ui/playease.ui.ad.js"
scripts[34]="./src/ui/playease.ui.share.js"
scripts[35]="./src/ui/playease.ui.logo.js"
scripts[36]="./src/ui/playease.ui.controlbar.js"
scripts[37]="./src/ui/playease.ui.contextmenu.js"

:>./release/playease.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/playease.js
done

uglifyjs ./release/playease.js -c -m --warn -o ./release/playease.min.js
