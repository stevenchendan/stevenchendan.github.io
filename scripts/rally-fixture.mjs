import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const modules={'three':T,'three/examples/jsm/utils/SkeletonUtils.js':{clone}};
export function loadModule(name){
  const id='./'+name;
  if(modules[id])return modules[id];
  const source=fs.readFileSync(new URL('../site/components/arena1573/'+name+'.ts',import.meta.url),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const m={exports:{}};
  vm.runInNewContext(outputText,{exports:m.exports,module:m,require:id=>modules[id]??loadModule(id.replace(/^\.\//,''))},{filename:name+'.ts'});
  modules[id]=m.exports;
  return m.exports;
}

export async function loadAthlete(){
  const bytes=fs.readFileSync(new URL('../public/models/tennis/rally-athlete.glb',import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
