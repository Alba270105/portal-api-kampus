const mysql = require('mysql2/promise');
const seed = require('../data/seed.json');

const endpoints = {
  berita: {
    from: 'berita b',
    select: 'b.id, b.judul, b.slug, b.ringkasan, b.isi, b.gambar_url, b.penulis, b.diterbitkan_pada',
    idColumn: 'b.id',
    slugColumn: 'b.slug',
    where: "b.status = 'published' AND b.diterbitkan_pada <= NOW()",
    search: ['b.judul', 'b.ringkasan', 'b.isi'],
    order: 'b.diterbitkan_pada DESC',
  },
  fakultas: {
    from: 'fakultas f',
    select: 'f.id, f.nama, f.slug, f.deskripsi, f.dekan, f.website_url',
    idColumn: 'f.id',
    slugColumn: 'f.slug',
    where: 'f.is_published = 1',
    search: ['f.nama', 'f.deskripsi', 'f.dekan'],
    order: 'f.nama ASC',
  },
  'program-studi': {
    from: 'program_studi ps INNER JOIN fakultas f ON f.id = ps.fakultas_id',
    select: 'ps.id, ps.fakultas_id, f.nama AS nama_fakultas, ps.nama, ps.slug, ps.jenjang, ps.akreditasi, ps.deskripsi',
    idColumn: 'ps.id',
    slugColumn: 'ps.slug',
    where: 'ps.is_published = 1 AND f.is_published = 1',
    search: ['ps.nama', 'f.nama', 'ps.jenjang', 'ps.akreditasi', 'ps.deskripsi'],
    order: 'f.nama ASC, ps.nama ASC',
  },
  pengumuman: {
    from: 'pengumuman p',
    select: 'p.id, p.judul, p.slug, p.ringkasan, p.isi, p.lampiran_url, p.diterbitkan_pada, p.berlaku_sampai',
    idColumn: 'p.id',
    slugColumn: 'p.slug',
    where: "p.status = 'published' AND p.diterbitkan_pada <= NOW() AND (p.berlaku_sampai IS NULL OR p.berlaku_sampai >= CURDATE())",
    search: ['p.judul', 'p.ringkasan', 'p.isi'],
    order: 'p.diterbitkan_pada DESC',
  },
};

let pool;

function getPool() {
  if (pool) return pool;

  const host = process.env.CAMPUS_DB_HOST;
  const database = process.env.CAMPUS_DB_NAME;
  const user = process.env.CAMPUS_DB_USER;
  const password = process.env.CAMPUS_DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error('CAMPUS_DB_HOST, CAMPUS_DB_NAME, CAMPUS_DB_USER, and CAMPUS_DB_PASSWORD must be configured');
  }

  pool = mysql.createPool({
    host,
    port: Number(process.env.CAMPUS_DB_PORT || 3306),
    database,
    user,
    password,
    ssl: process.env.CAMPUS_DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });

  return pool;
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(JSON.stringify(body));
}

function readQueryString(value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value) && value.length === 1) {
    return readQueryString(value[0]);
  }
  return null;
}

function readSeed(endpoint, identifier, search, page, perPage, res) {
  const searchableFields = {
    berita: ['judul', 'ringkasan', 'isi'],
    fakultas: ['nama', 'deskripsi', 'dekan'],
    'program-studi': ['nama', 'nama_fakultas', 'jenjang', 'akreditasi', 'deskripsi'],
    pengumuman: ['judul', 'ringkasan', 'isi'],
  }[endpoint];
  let rows = seed[endpoint];

  if (endpoint === 'pengumuman') {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter(item => !item.berlaku_sampai || item.berlaku_sampai >= today);
  }
  if (search) {
    const query = search.toLocaleLowerCase('id');
    rows = rows.filter(item => searchableFields.some(field =>
      String(item[field] || '').toLocaleLowerCase('id').includes(query),
    ));
  }
  if (identifier !== undefined) {
    const item = rows.find(entry =>
      String(entry.id) === identifier || entry.slug === identifier,
    );
    return item
      ? sendJson(res, 200, { data: item })
      : sendJson(res, 404, { error: 'Data not found' });
  }

  const offset = (page - 1) * perPage;
  return sendJson(res, 200, {
    data: rows.slice(offset, offset + perPage),
    meta: {
      page,
      per_page: perPage,
      total: rows.length,
      total_pages: Math.ceil(rows.length / perPage),
    },
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : typeof req.query.path === 'string'
      ? req.query.path.split('/').filter(Boolean)
      : [];
  const [resource, identifier] = segments;
  const endpoint = endpoints[resource];

  if (!endpoint || segments.length > 2) {
    return sendJson(res, 404, { error: 'Endpoint not found' });
  }

  const pageValue = readQueryString(req.query.page, '1');
  const perPageValue = readQueryString(req.query.per_page, '10');
  if (pageValue === null || !/^[1-9]\d*$/.test(pageValue)) {
    return sendJson(res, 400, { error: 'page must be a positive integer' });
  }
  if (perPageValue === null || !/^[1-9]\d*$/.test(perPageValue)) {
    return sendJson(res, 400, { error: 'per_page must be an integer between 1 and 100' });
  }

  const page = Number(pageValue);
  const perPage = Number(perPageValue);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(perPage) || perPage > 100) {
    return sendJson(res, 400, { error: 'page must be a positive integer and per_page must be between 1 and 100' });
  }

  const searchValue = readQueryString(req.query.q, '');
  if (searchValue === null || searchValue.length > 150) {
    return sendJson(res, 400, { error: 'q must be a string of at most 150 characters' });
  }

  const params = [];
  let where = endpoint.where;
  const search = searchValue.trim();
  if (search) {
    where += ' AND (' + endpoint.search.map(column => {
      params.push(`%${search}%`);
      return `${column} LIKE ?`;
    }).join(' OR ') + ')';
  }

  const baseQuery = ` FROM ${endpoint.from} WHERE ${where}`;
  const hasDatabaseConfig = [
    'CAMPUS_DB_HOST',
    'CAMPUS_DB_NAME',
    'CAMPUS_DB_USER',
    'CAMPUS_DB_PASSWORD',
  ].every(name => Boolean(process.env[name]));

  if (!hasDatabaseConfig) {
    if (!Number.isSafeInteger((page - 1) * perPage)) {
      return sendJson(res, 400, { error: 'page is too large' });
    }
    return readSeed(resource, identifier, search, page, perPage, res);
  }

  try {
    const db = getPool();

    if (identifier !== undefined) {
      const column = /^\d+$/.test(identifier) ? endpoint.idColumn : endpoint.slugColumn;
      const value = column === endpoint.idColumn ? Number(identifier) : identifier;
      if (column === endpoint.idColumn && !Number.isSafeInteger(value)) {
        return sendJson(res, 404, { error: 'Data not found' });
      }
      const [rows] = await db.execute(
        `SELECT ${endpoint.select}${baseQuery} AND ${column} = ? LIMIT 1`,
        [...params, value],
      );
      if (rows.length === 0) {
        return sendJson(res, 404, { error: 'Data not found' });
      }
      return sendJson(res, 200, { data: rows[0] });
    }

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total${baseQuery}`, params);
    const total = Number(countRows[0].total);
    const offset = (page - 1) * perPage;
    if (!Number.isSafeInteger(offset)) {
      return sendJson(res, 400, { error: 'page is too large' });
    }
    const [rows] = await db.execute(
      `SELECT ${endpoint.select}${baseQuery} ORDER BY ${endpoint.order} LIMIT ? OFFSET ?`,
      [...params, perPage, offset],
    );

    return sendJson(res, 200, {
      data: rows,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Campus API database error:', error);
    return sendJson(res, 500, { error: 'Unable to retrieve data' });
  }
};
