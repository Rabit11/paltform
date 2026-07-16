import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import api from './api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', api);

// 生产/演示模式：托管前端构建产物
const dist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`✔ 科研项目信息化管理平台 API @ http://localhost:${PORT}${existsSync(dist) ? '（含前端静态托管）' : ''}`);
});
