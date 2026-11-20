const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const SystemTaskManager = require('../electron/services/SystemTaskManager.cjs');

function fakeDb() {
  const apps = [];
  let nextId = 1;
  return {
    apps,
    prepare(sql) {
      return {
        get(value) {
          if (sql.includes('WHERE executable_path')) return apps.find(x => x.executable_path === value);
          if (sql.includes('WHERE id')) return apps.find(x => x.id === Number(value));
        },
        all() { return apps.slice(); },
        run(...args) {
          if (sql.startsWith('INSERT')) { const item={id:nextId++,name:args[0],executable_path:args[1]}; apps.push(item); return {lastInsertRowid:item.id}; }
          if (sql.startsWith('DELETE')) { const i=apps.findIndex(x=>x.id===Number(args[0])); if(i>=0)apps.splice(i,1); return {changes:i>=0?1:0}; }
        }
      };
    }
  };
}
function fakeSpawn() {
  const calls=[];
  const spawnImpl=(command,args,options)=>{const child=new EventEmitter();child.pid=4321;child.exitCode=null;child.killed=false;child.unref=()=>{};child.kill=(signal)=>{child.killed=true;calls.push({kill:signal});return true;};calls.push({command,args,options,child});process.nextTick(()=>child.emit('spawn'));return child;};
  return {spawnImpl,calls};
}

test('registers only executable files and rejects duplicate paths', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mephisto-task-'));
  const executable=path.join(dir,'demo');fs.writeFileSync(executable,'#!/bin/sh\n');fs.chmodSync(executable,0o755);
  const db=fakeDb();const manager=new SystemTaskManager({db,platform:'linux',spawnImpl:fakeSpawn().spawnImpl});
  const id=manager.add({name:'Demo',executablePath:executable});
  assert.equal(id,1);
  assert.throws(()=>manager.add({name:'Duplicate',executablePath:executable}),/already registered/);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('launches without a shell and closes only a process launched in this session', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mephisto-task-'));
  const executable=path.join(dir,'demo');fs.writeFileSync(executable,'#!/bin/sh\n');fs.chmodSync(executable,0o755);
  const db=fakeDb();const {spawnImpl,calls}=fakeSpawn();const killed=[];
  const manager=new SystemTaskManager({db,platform:'linux',spawnImpl,killImpl:(pid,signal)=>killed.push({pid,signal})});
  const id=manager.add({name:'Demo',executablePath:executable});
  const result=await manager.launch(id);
  assert.equal(result.started,true);
  assert.equal(calls[0].options.shell,false);
  await new Promise(resolve=>setImmediate(resolve));
  const closed=await manager.close(id);
  assert.equal(closed.closed,true);
  assert.deepEqual(killed,[{pid:4321,signal:'SIGTERM'}]);
  await assert.rejects(()=>manager.close(id),/only when it was launched/);
  fs.rmSync(dir,{recursive:true,force:true});
});


test('launch waits for the operating system spawn event and reports launch errors', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mephisto-task-'));
  const executable=path.join(dir,'demo.exe');fs.writeFileSync(executable,'test');
  const db=fakeDb();
  const failingSpawn=()=>{const child=new EventEmitter();child.unref=()=>{};process.nextTick(()=>{const error=new Error('The system cannot find the file specified');error.code='ENOENT';child.emit('error',error);});return child;};
  const manager=new SystemTaskManager({db,platform:'win32',spawnImpl:failingSpawn});
  const id=manager.add({name:'Demo',executablePath:executable});
  await assert.rejects(()=>manager.launch(id),/ENOENT.*system cannot find the file/i);
  assert.equal(manager.running.has(id),false);
  fs.rmSync(dir,{recursive:true,force:true});
});


test('Windows closes a registered app using an encoded, path-verified PowerShell command', async () => {
  const executable='C:\\Apps\\Task Manager\\Taskmgr.exe';
  const db=fakeDb();db.apps.push({id:7,name:'Task Manager',executable_path:executable});
  let call;
  const spawnImpl=(command,args,options)=>{call={command,args,options};const child=new EventEmitter();child.exitCode=null;process.nextTick(()=>{child.emit('exit',0);child.emit('close',0);});return child;};
  const manager=new SystemTaskManager({db,platform:'win32',spawnImpl});
  const result=await manager.close(7);
  assert.equal(result.closed,true);
  assert.match(call.command,/powershell\.exe$/i);
  assert.ok(call.args.includes('-EncodedCommand'));
  const encoded=call.args.at(-1);
  const decoded=Buffer.from(encoded,'base64').toString('utf16le');
  assert.match(decoded,/Get-CimInstance -ClassName Win32_Process/);
  assert.match(decoded,/CreationDate/);
  assert.match(decoded,/Stop-Process/);
  assert.equal(call.options.shell,false);
  assert.deepEqual(call.options.stdio,['ignore','pipe','pipe']);
});

test('Windows returns the PowerShell diagnostic instead of a generic close error', async () => {
  const { PassThrough } = require('node:stream');
  const db=fakeDb();db.apps.push({id:8,name:'Task Manager',executable_path:'C:\\Windows\\System32\\Taskmgr.exe'});
  const spawnImpl=()=>{
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
    process.nextTick(()=>{child.emit('exit',1);setImmediate(()=>{child.stderr.write('Access is denied');child.emit('close',1);});});
    return child;
  };
  const manager=new SystemTaskManager({db,platform:'win32',spawnImpl});
  await assert.rejects(()=>manager.close(8),/Access is denied/);
});

test('cannot remove a registered app while it is running', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mephisto-task-'));
  const executable=path.join(dir,'demo');fs.writeFileSync(executable,'#!/bin/sh\n');fs.chmodSync(executable,0o755);
  const db=fakeDb();const {spawnImpl}=fakeSpawn();const manager=new SystemTaskManager({db,platform:'linux',spawnImpl});
  const id=manager.add({name:'Demo',executablePath:executable});await manager.launch(id);
  assert.throws(()=>manager.remove(id),/Close the application/);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('desktop automation permission is disabled by default', () => {
  const Permissions = require('../electron/security/PermissionManager.cjs');
  assert.equal(Permissions.normalize({}).desktopAutomationPermission, false);
  assert.throws(() => Permissions.requirePermission({}, 'desktopAutomationPermission'), /Permission denied/);
  assert.equal(Permissions.requirePermission({desktopAutomationPermission:true}, 'desktopAutomationPermission'), true);
});
