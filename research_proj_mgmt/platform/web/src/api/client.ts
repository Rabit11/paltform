let currentUserId = localStorage.getItem('srpm.user') || ''

export function setApiUser(id: string) {
  currentUserId = id
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user': currentUserId,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `请求失败 (${res.status})`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body || {}) }),
}

/** 文件上传（multipart，不能带 JSON content-type） */
export async function apiUpload(file: File): Promise<{ id: number; name: string; sizeKb: number }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/uploads', { method: 'POST', headers: { 'x-user': currentUserId }, body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `上传失败 (${res.status})`)
  }
  return res.json()
}
