import supabase from './db-client.js';

const TABLES = {
  cases: 'cases',
  documents: 'documents',
  blocks: 'blocks',
  transactions: 'transactions',
  audit: 'audit_events',
  shares: 'shares',
  users: 'users',
  notifications: 'notifications',
};

const ORDER = {
  cases: { col: 'id', asc: true },
  documents: { col: 'updated_at', asc: false },
  blocks: { col: 'block_number', asc: false },
  transactions: { col: 'timestamp', asc: false },
  audit: { col: 'timestamp', asc: false },
  shares: { col: 'id', asc: true },
  users: { col: 'id', asc: true },
  notifications: { col: 'time', asc: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const resource = req.query.resource;
  const table = TABLES[resource];
  if (!table) return res.status(400).json({ error: 'Unknown resource. Use ?resource=cases|documents|blocks|transactions|audit|shares|users|notifications' });

  try {
    if (req.method === 'GET') {
      const o = ORDER[resource];
      let q = supabase.from(table).select('*').order(o.col, { ascending: o.asc }).limit(500);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const row = req.body && req.body.row ? req.body.row : req.body;
      const { data, error } = await supabase.from(table).insert(row).select();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { idCol, idVal, patch, match } = req.body || {};
      let q = supabase.from(table).update(patch || {});
      if (match && typeof match === 'object') {
        for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      } else if (idCol && idVal !== undefined) {
        q = q.eq(idCol, idVal);
      } else if (req.body && req.body.id !== undefined) {
        q = q.eq('id', req.body.id);
      } else {
        return res.status(400).json({ error: 'PUT needs {idCol,idVal,patch} or {match,patch}' });
      }
      const { data, error } = await q.select();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const body = req.body || {};
      const match = body.match || (body.idCol ? { [body.idCol]: body.idVal } : null);
      if (!match) {
        // allow query-string delete: ?resource=x&idCol=y&idVal=z
        const { idCol, idVal } = req.query;
        if (!idCol || idVal === undefined) return res.status(400).json({ error: 'DELETE needs match or idCol+idVal' });
        const { error } = await supabase.from(table).delete().eq(idCol, idVal);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
