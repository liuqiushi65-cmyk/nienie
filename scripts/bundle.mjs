import fs from 'node:fs';
import { MATERIALS } from '../app/web/model.mjs';
const atlases={};
const required=['artifacts/slime-audio/samples.json'];
for(const [material,spec] of Object.entries(MATERIALS)){
  if(!spec.sequenceFrames)continue;
  required.push(`artifacts/${material}-sequence/manifest.json`,`artifacts/anger-burst/${material}-core.png`);
  for(let i=0;i<Math.ceil(spec.sequenceFrames/16);i++)required.push(`artifacts/${material}-sequence/atlas-${i}.png`);
}
const missing=required.filter(file=>!fs.existsSync(file));
if(missing.length)throw new Error(`缺少 ${missing.length} 个运行素材，例如 ${missing[0]}。请先执行：python3 scripts/runtime_assets.py install /path/to/nienie-runtime-assets-v1.zip`);
const slimeAudio=JSON.parse(fs.readFileSync('artifacts/slime-audio/samples.json','utf8'));
if(slimeAudio.rate!==44100||['gel','stretch','fold'].some(kind=>
  slimeAudio.clips?.[kind]?.length!==6||slimeAudio.clips[kind].some(pcm=>typeof pcm!=='string'||Buffer.from(pcm,'base64').length<8000)))throw new Error('软泥实录素材不完整，请先运行 prepare-slime-audio.py');
for(const [material,spec] of Object.entries(MATERIALS)){
  if(!spec.sequenceFrames)continue;
  const sequenceDir=`artifacts/${material}-sequence`;
  if(!fs.existsSync(`${sequenceDir}/manifest.json`))throw new Error(`缺少 ${material} 透明序列，不能用占位图构建`);
  const atlas=JSON.parse(fs.readFileSync(`${sequenceDir}/manifest.json`,'utf8'));
  if(atlas.count!==spec.sequenceFrames||atlas.pages.length!==Math.ceil(atlas.count/atlas.perPage))throw new Error(`${material} 帧数不符合交互合同`);
  atlas.pages=atlas.pages.map(name=>`data:image/png;base64,${fs.readFileSync(`${sequenceDir}/${name}`).toString('base64')}`);
  atlas.core=`data:image/png;base64,${fs.readFileSync(`artifacts/anger-burst/${material}-core.png`).toString('base64')}`;
  atlases[material]=atlas;
}
const parts=['lychee','model','sequence','completion','anger-voice','audio','lychee-renderer','sequence-renderer','renderer','app'].map(name=>fs.readFileSync(`app/web/${name}.mjs`,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''));
const output=process.argv[2]||'build/web';fs.mkdirSync(output,{recursive:true});
// file:// 下外部纹理会污染 Canvas，内嵌素材以保留透明像素命中检测。
let code=parts.join('\n');
code=code.replace('const FRUIT_ATLASES=null;',`const FRUIT_ATLASES=${JSON.stringify(atlases)};`);
code=code.replace('const SLIME_AUDIO=null;',`const SLIME_AUDIO=${JSON.stringify({rate:slimeAudio.rate,clips:slimeAudio.clips})};`);
for(const name of ['lychee-shell','lychee-core'])code=code.replaceAll(`assets/${name}.png`,`data:image/png;base64,${fs.readFileSync(`app/web/assets/${name}.png`).toString('base64')}`);
fs.writeFileSync(`${output}/bundle.js`,'(()=>{\n"use strict";\n'+code+'\n})();\n');
for(const name of ['index.html','style.css'])fs.copyFileSync(`app/web/${name}`,`${output}/${name}`);
