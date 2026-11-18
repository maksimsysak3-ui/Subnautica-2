// Bundles game.js (+ three.js) into one self-contained index.html — no CDN, no import map, works offline.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const out=await build({entryPoints:['game.js'],bundle:true,minify:true,format:'iife',target:'es2020',write:false,legalComments:'none'});
const js=out.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=readFileSync('shell.html','utf8').replace('/*GAME*/',()=>js);
writeFileSync('index.html',html);
console.log('index.html',(html.length/1024).toFixed(0)+' KB');
