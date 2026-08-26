#!/bin/sh
D=/home/user/Subnautica-2
cat $D/.build/00-head.html $D/.build/10-math.js $D/.build/20-gl.js $D/.build/30-geo.js \
    $D/.build/40-world.js $D/.build/50-sim.js $D/.build/60-render.js $D/.build/70-ui.js \
    $D/.build/80-main.js > $D/city.html
echo '</script></body></html>' >> $D/city.html
cat $D/.build/[1-8]*.js > /tmp/claude-0/-home-user-Subnautica-2/3d03323c-a129-5883-b316-cf388ad60cf6/scratchpad/all.js
node --check /tmp/claude-0/-home-user-Subnautica-2/3d03323c-a129-5883-b316-cf388ad60cf6/scratchpad/all.js && echo "BUILD OK $(wc -l < $D/city.html) lines"
