import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Canvas only supplies appearance. Geometry, world transforms, seats and roof
// positions are built by the production modules using real Three.js objects.
const modules=new Map();
const document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},fill(){}})})};
export function loadArenaModule(name){
  if(name==='three')return THREE;
  if(name.startsWith('three/'))return {mergeGeometries};
  const key=name.replace('./','');
  if(modules.has(key))return modules.get(key);
  const m={exports:{}};modules.set(key,m.exports);
  const url=new URL('../site/components/arena1573/'+key+'.ts',import.meta.url);
  const source=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
  vm.runInNewContext(source.outputText,{module:m,exports:m.exports,require:loadArenaModule,document,TextDecoder,fetch:(...args)=>fetch(...args)});
  return m.exports;
}
