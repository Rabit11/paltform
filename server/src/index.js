import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import api from './api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: false,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use((req, res, next) => {
  const requestId = String(req.header('x-request-id') || randomUUID()).slice(0, 100);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'srpm', version: '1.2.0' }));
app.use('/api', api);

import http from 'node:http';
import { URL } from 'node:url';
const FORM_TOOL_UPSTREAM = process.env.FORM_TOOL_UPSTREAM || 'http://172.17.0.1:8092';
function proxyFormTool(req, res) {
  const upstream = new URL(FORM_TOOL_UPSTREAM);
  const suffix = (req.url && req.url !== '') ? req.url : '/';
  const headers = { ...req.headers, host: upstream.host };
  const opts = {
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port || 80,
    path: suffix,
    method: req.method,
    headers,
  };
  const pReq = http.request(opts, (pRes) => {
    const outHeaders = { ...pRes.headers };
    delete outHeaders['x-frame-options'];
    delete outHeaders['content-security-policy'];
    res.writeHead(pRes.statusCode || 502, outHeaders);
    pRes.pipe(res);
  });
  pReq.on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: '表单维护工具(8092)不可用', detail: String(err.message || err) }));
  });
  req.pipe(pReq);
}
// FORM_TOOL_PROXY_V1
app.use('/form-tool', proxyFormTool);


// 生产/演示模式：托管前端构建产物
const dist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  // 未命中的 js/css 等静态资源必须 404，禁止回退成 index.html（否则大屏会把 HTML 当 echarts.min.js 加载）
  app.get(/^(?!\/api).*/, (req, res) => {
    if (/\.[a-z0-9]+$/i.test(req.path)) {
      res.status(404).type('text/plain').send('not found');
      return;
    }
    res.sendFile(join(dist, 'index.html'));
  });
}

app.use((error, req, res, _next) => {
  console.error(`[${req.requestId || '-'}]`, error);
  res.status(500).json({ error: '服务器内部错误', requestId: req.requestId });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`✔ 科研项目信息化管理平台 API @ http://localhost:${PORT}${existsSync(dist) ? '（含前端静态托管）' : ''}`);
});
