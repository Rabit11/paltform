import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '../uploads');

export async function ensureUploadRoot() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

export function uploadRoot() {
  return UPLOAD_ROOT;
}

/** 保存 base64 文件列表，返回 DB 记录数据 */
export async function saveProjectFiles({ projectId, applicationId, folderName, files, uploadedBy }) {
  await ensureUploadRoot();
  const ownerId = projectId || applicationId || 'temp';
  const batchDir = path.join(UPLOAD_ROOT, ownerId, `${Date.now()}`);
  await fs.mkdir(batchDir, { recursive: true });

  const records = [];
  for (const f of files || []) {
    if (!f.fileName && !f.relativePath) continue;
    const rel = f.relativePath || f.fileName;
    const safeRel = rel.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const dest = path.join(batchDir, safeRel);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    if (f.content) {
      await fs.writeFile(dest, Buffer.from(f.content, 'base64'));
    } else if (f.contentText != null) {
      await fs.writeFile(dest, f.contentText, 'utf8');
    }

    const stat = await fs.stat(dest).catch(() => null);
    records.push({
      projectId: projectId || null,
      applicationId: applicationId || null,
      folderName: folderName || '项目材料',
      relativePath: safeRel,
      fileName: f.fileName || path.basename(safeRel),
      mimeType: f.mimeType || null,
      size: stat?.size || f.size || 0,
      storageKey: path.relative(UPLOAD_ROOT, dest),
      uploadedBy,
    });
  }
  return records;
}

export async function listProjectFiles(prisma, projectId) {
  return prisma.projectFile.findMany({
    where: { projectId },
    orderBy: [{ folderName: 'asc' }, { relativePath: 'asc' }],
  });
}
