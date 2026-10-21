const seed = require('../data/seed.json');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  res.setHeader('Allow', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const route = req.query.path || new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean).slice(1);
  const parts = Array.isArray(route) ? route : String(route).split('/').filter(Boolean);
  const [resource, identifier] = parts;
  let rows = seed[resource];
  if (!rows || parts.length > 2) return send(res, 404, { error: 'Endpoint not found' });

  const pageValue = req.query.page || '1';
  const sizeValue = req.query.per_page || '10';
  if (!/^\\d+$/.test(String(pageValue)) || Number(pageValue) < 1) return send(res, 400, { error: 'page must be a positive integer' });
  if (!/^\\d+$/.test(String(sizeValue)) || Number(sizeValue) < 1 || Number(sizeValue) > 100) return send(res, 400, { error: 'per_page must be between 1 and 100' });
  const page = Number(pageValue);
  const perPage = Number(sizeValue);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(perPage) || !Number.isSafeInteger((page - 1) * perPage)) {
    return send(res, 400, { error: 'page is too large' });
  }

  const searchValue = req.query.q || '';
  if (typeof searchValue !== 'string' || searchValue.length > 150) return send(res, 400, { error: 'q must be at most 150 characters' });
  const searchableFields = {
    berita: ['judul', 'ringkasan', 'isi'],
    fakultas: ['nama', 'deskripsi', 'dekan'],
    'program-studi': ['nama', 'nama_fakultas', 'jenjang', 'akreditasi', 'deskripsi'],
    pengumuman: ['judul', 'ringkasan', 'isi'],
  }[resource];
  if (resource === 'pengumuman') {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter(item => !item.berlaku_sampai || item.berlaku_sampai >= today);
  }
  const search = searchValue.trim().toLocaleLowerCase('id');
  if (search) rows = rows.filter(item => searchableFields.some(field => String(item[field] || '').toLocaleLowerCase('id').includes(search)));

  if (identifier !== undefined) {
    const item = rows.find(entry => String(entry.id) === identifier || entry.slug === identifier);
    return item ? send(res, 200, { data: item }) : send(res, 404, { error: 'Data not found' });
  }
  const total = rows.length;
  return send(res, 200, {
    data: rows.slice((page - 1) * perPage, page * perPage),
    meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  });
};
