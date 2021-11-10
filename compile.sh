#!/bin/sh

scripts=()
scripts[0]="./release/playease.api.min.js"
scripts[1]="./src/ui/playease.ui.js"
scripts[2]="./src/ui/components/playease.ui.components.js"
scripts[3]="./src/ui/components/playease.ui.components.button.js"
scripts[4]="./src/ui/components/playease.ui.components.label.js"
scripts[5]="./src/ui/components/playease.ui.components.preview.js"
scripts[6]="./src/ui/components/playease.ui.components.select.js"
scripts[7]="./src/ui/components/playease.ui.components.slider.js"
scripts[8]="./src/ui/components/playease.ui.components.panel.js"
scripts[9]="./src/ui/playease.ui.poster.js"
scripts[10]="./src/ui/playease.ui.danmu.js"
scripts[11]="./src/ui/playease.ui.display.js"
scripts[12]="./src/ui/playease.ui.ad.js"
scripts[13]="./src/ui/playease.ui.share.js"
scripts[14]="./src/ui/playease.ui.logo.js"
scripts[15]="./src/ui/playease.ui.controlbar.js"
scripts[16]="./src/ui/playease.ui.contextmenu.js"

:>./release/playease.js

for item in ${scripts[@]};
do
    echo ${item}
    cat ${item} >> ./release/playease.js
done

uglifyjs ./release/playease.js -c -m --warn -o ./release/playease.min.js
