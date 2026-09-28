const SQL_KEY = 'wenbebi-sql-v1';

function read() {
  try {
    const raw = wx.getStorageSync(SQL_KEY);
    if (raw && raw.tables) return raw;
  } catch (err) {
    // 第一次打开还没有库
  }
  return { tables: {} };
}

function write(data) {
  wx.setStorageSync(SQL_KEY, data);
}

function table(data, name) {
  if (!data.tables[name]) data.tables[name] = [];
  return data.tables[name];
}

function conditions(where) {
  if (!where) return [];
  return where.split(/\s+and\s+/i).map((part) => {
    const text = part.trim();
    const param = /^(\w+)\s*=\s*\?$/.exec(text);
    if (param) return { col: param[1], param: true };
    const num = /^(\w+)\s*=\s*(-?\d+)$/.exec(text);
    if (num) return { col: num[1], param: false, value: Number(num[2]) };
    throw new Error(`暂不支持的条件：${part}`);
  });
}

function same(row, conds, params) {
  let index = 0;
  for (let i = 0; i < conds.length; i += 1) {
    const value = conds[i].param ? params[index++] : conds[i].value;
    if (row[conds[i].col] !== value) return false;
  }
  return true;
}

function run(sql, params) {
  const data = read();
  const text = sql.replace(/\s+/g, ' ').trim();
  const values = params || [];
  let insert = /^insert into (\w+) \(([^)]+)\) values \(([^)]+)\)$/i.exec(text);
  if (insert) {
    const name = insert[1];
    const cols = insert[2].split(',').map((item) => item.trim());
    const marks = insert[3].split(',').map((item) => item.trim());
    if (marks.some((mark) => mark !== '?') || marks.length !== cols.length || marks.length !== values.length) {
      throw new Error(`插入参数不匹配：${sql}`);
    }
    const row = {};
    cols.forEach((col, index) => { row[col] = values[index]; });
    const rows = table(data, name);
    if (name === 'journal' && (row.id === undefined || row.id === null)) {
      row.id = rows.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
    }
    rows.push(row);
    write(data);
    return { changes: 1 };
  }
  const update = /^update (\w+) set (.+) where (.+)$/i.exec(text);
  if (update) {
    const name = update[1];
    const sets = update[2].split(',').map((item) => {
      const matched = /^(\w+)\s*=\s*\?$/.exec(item.trim());
      if (!matched) throw new Error(`暂不支持的赋值：${item}`);
      return matched[1];
    });
    const where = conditions(update[3]);
    const whereParams = where.filter((item) => item.param).length;
    if (sets.length + whereParams !== values.length) throw new Error(`更新参数不匹配：${sql}`);
    let changes = 0;
    table(data, name).forEach((row) => {
      if (!same(row, where, values.slice(sets.length))) return;
      sets.forEach((col, index) => { row[col] = values[index]; });
      changes += 1;
    });
    write(data);
    return { changes };
  }
  const remove = /^delete from (\w+) where (.+)$/i.exec(text);
  if (remove) {
    const name = remove[1];
    const where = conditions(remove[2]);
    const rows = table(data, name);
    const kept = rows.filter((row) => !same(row, where, values));
    data.tables[name] = kept;
    write(data);
    return { changes: rows.length - kept.length };
  }
  throw new Error(`暂不支持的语句：${sql}`);
}

function all(sql, params) {
  const data = read();
  const text = sql.replace(/\s+/g, ' ').trim();
  const values = params || [];
  const matched = /^select (.+) from (\w+)(?: where (.+))?$/i.exec(text);
  if (!matched) throw new Error(`暂不支持的查询：${sql}`);
  const columns = matched[1].trim() === '*' ? null : matched[1].split(',').map((item) => item.trim());
  const where = conditions(matched[3]);
  if (where.filter((item) => item.param).length !== values.length) throw new Error(`查询参数不匹配：${sql}`);
  return table(data, matched[2]).filter((row) => same(row, where, values)).map((row) => {
    if (!columns) return Object.assign({}, row);
    const copy = {};
    columns.forEach((col) => { copy[col] = row[col]; });
    return copy;
  });
}

function get(sql, params) {
  return all(sql, params)[0] || null;
}

export function openDb() {
  const data = read();
  ['cards', 'events', 'player', 'inventory', 'flags', 'journal', 'seen', 'day_events', 'log', 'body', 'people'].forEach((name) => {
    if (!data.tables[name]) data.tables[name] = [];
  });
  write(data);
  return { run, all, get };
}
