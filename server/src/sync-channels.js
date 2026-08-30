/**
 * 按附件口径同步渠道字典：改名、改流程、并入旧渠道、停用附件未列渠道。
 * 不删项目、不 drop 表。
 * docker exec -w /app/server srpm-18095 node src/sync-channels.js
 */
import { openDb, createSchema } from './db.js';
import { CHANNEL_SPEC, DECLARE_CHAIN, MERGE_INTO, TYPE_KEY_ALIASES, specByKey } from './channelSpec.js';

const db = openDb();
createSchema(db);

const specMap = specByKey();
const keep = new Set(CHANNEL_SPEC.map((c) => c.key));

function deptOf(c) {
  return c.level === '公司级' ? c.orgOffice : '科研项目处';
}

const findByKey = db.prepare('SELECT * FROM channels WHERE key=?');
const findByNameLevel = db.prepare('SELECT * FROM channels WHERE name=? AND level=?');
const updRow = db.prepare(`UPDATE channels SET
  key=?, name=?, level=?, source_channel=?, org_office=?, org=?, dept=?,
  flow_json=?, declare_json=?, filing_json=?, approve_chain_json=?, declare_mode=?, assess_json=?, enabled=1
  WHERE id=?`);
const insRow = db.prepare(`INSERT INTO channels
  (key,name,level,source_channel,org_office,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
const remapProj = db.prepare('UPDATE projects SET channel_id=? WHERE channel_id=?');
const disable = db.prepare('UPDATE channels SET enabled=0 WHERE id=?');

const tx = db.transaction(() => {
  const log = [];
  for (const c of CHANNEL_SPEC) {
    const payload = [
      c.key, c.name, c.level, c.sourceChannel, c.orgOffice, c.orgOffice, deptOf(c),
      JSON.stringify(c.flow),
      JSON.stringify(c.declare || []),
      JSON.stringify(c.filing || []),
      JSON.stringify(c.chain || DECLARE_CHAIN),
      c.mode || '审批',
      JSON.stringify(c.assess || []),
    ];
    let row = findByKey.get(c.key);
    if (!row) row = findByNameLevel.get(c.name, c.level);
    if (row) {
      updRow.run(...payload, row.id);
      log.push(`update ${c.key} #${row.id} ${c.name}`);
    } else {
      insRow.run(...payload);
      log.push(`insert ${c.key} ${c.name}`);
    }
  }

  for (const [fromKey, toKey] of Object.entries(MERGE_INTO)) {
    if (keep.has(fromKey)) continue;
    const from = findByKey.get(fromKey);
    const to = findByKey.get(toKey);
    if (!from || !to || from.id === to.id) continue;
    const n = remapProj.run(to.id, from.id).changes;
    disable.run(from.id);
    log.push(`merge ${fromKey} → ${toKey} projects=${n}`);
  }

  const extras = db.prepare('SELECT id,key,name FROM channels').all()
    .filter((r) => !keep.has(r.key));
  for (const r of extras) {
    const toKey = TYPE_KEY_ALIASES[r.name] || TYPE_KEY_ALIASES[r.key] || MERGE_INTO[r.key];
    const to = toKey ? findByKey.get(toKey) : null;
    if (to && to.id !== r.id) {
      const n = remapProj.run(to.id, r.id).changes;
      log.push(`alias ${r.key}/${r.name} → ${toKey} projects=${n}`);
    }
    disable.run(r.id);
    log.push(`disable ${r.key} ${r.name}`);
  }
  return log;
});

const lines = tx();
for (const line of lines) console.log(line);
const live = db.prepare('SELECT key,name,level,enabled FROM channels ORDER BY level, key').all();
console.log('--- live ---');
for (const r of live) console.log(`${r.enabled ? 'on ' : 'off'} ${r.key}\t${r.level}\t${r.name}`);
db.close();
