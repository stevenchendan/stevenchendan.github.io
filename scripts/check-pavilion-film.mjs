import assert from 'node:assert/strict';
import {loadArenaModule as load} from '../scripts/arena-model-fixture.mjs';
const {film,filmPosition,filmFieldOfView}=load('film');
const shot=film.find(s=>s.title==='光映玻璃');
assert.equal(shot.seconds,12);
for(let i=0;i<=120;i++){
 const p=filmPosition(shot,i/120);
 assert.ok(p.every(Number.isFinite));
 assert.ok(p[0]>270&&p[0]<300,'Camera stays in terrace corridor, clear of pavilion and Kia');
 assert.ok(p[1]>5&&p[1]<=18);
}
assert.ok(filmFieldOfView(shot,9/16)>filmFieldOfView(shot,16/9));
console.log('Pavilion shot path, clearance corridor and portrait framing passed.');
