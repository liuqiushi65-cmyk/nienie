import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('新检出缺少素材时给出导入命令，不产生半成品 bundle',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nienie-bundle-test-'));
  try{
    const output=path.join(root,'web');
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/bundle.mjs',import.meta.url)),output],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/runtime_assets\.py install/);
    assert.match(result.stderr,/slime-audio\/samples\.json/);
    assert.equal(fs.existsSync(output),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
