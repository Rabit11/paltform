#!/usr/bin/env python3
"""Deploy SRPM platform to remote server via SSH/SFTP."""
import os
import sys
import tarfile
import tempfile
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "10.90.111.114")
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
USER = os.environ.get("DEPLOY_USER", "yanghuiran")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
REMOTE_BASE = os.environ.get("DEPLOY_REMOTE_DIR", "/data_SSD_21T/users/yanghuiran/yanghuiran")
REMOTE_DIR = f"{REMOTE_BASE}/srpm-platform"
SRPM_PORT = os.environ.get("SRPM_PORT", "8085")

PLATFORM_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

SKIP_DIRS = {"node_modules", ".git", "dist", "data", "__pycache__"}
SKIP_FILES = {".env"}


def should_skip(path: str) -> bool:
    parts = path.replace("\\", "/").split("/")
    if any(p in SKIP_DIRS for p in parts):
        return True
    if os.path.basename(path) in SKIP_FILES:
        return True
    return False


def create_tarball(src_dir: str) -> str:
    fd, tar_path = tempfile.mkstemp(suffix=".tgz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src_dir).replace("\\", "/")
                if should_skip(rel):
                    continue
                tar.add(full, arcname=rel)
    return tar_path


def run(ssh, cmd: str, timeout=600) -> tuple[int, str, str]:
    print(f"  $ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out.rstrip())
    if err:
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def main():
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD environment variable", file=sys.stderr)
        sys.exit(1)

    print(f"=== Packaging {PLATFORM_DIR} ===")
    tar_path = create_tarball(PLATFORM_DIR)
    tar_size = os.path.getsize(tar_path)
    print(f"  Archive: {tar_size / 1024 / 1024:.1f} MB")

    print(f"=== Connecting to {USER}@{HOST}:{PORT} ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    print(f"=== Uploading to {REMOTE_DIR} ===")
    sftp = ssh.open_sftp()
    run(ssh, f"mkdir -p {REMOTE_DIR}")
    remote_tar = f"{REMOTE_BASE}/srpm-deploy.tgz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    print("=== Extracting on remote ===")
    run(ssh, f"rm -rf {REMOTE_DIR} && mkdir -p {REMOTE_DIR}")
    run(ssh, f"tar xzf {remote_tar} -C {REMOTE_DIR}")
    run(ssh, f"rm -f {remote_tar}")

    print(f"=== Writing .env (SRPM_PORT={SRPM_PORT}) ===")
    env_content = f"""SRPM_PORT={SRPM_PORT}
NPM_REGISTRY=https://registry.npmmirror.com
APT_MIRROR=mirrors.aliyun.com
GLM_API_KEY=
AI_PROVIDER=openai
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AI_MODEL=glm-5.2
"""
    run(ssh, f"cat > {REMOTE_DIR}/.env << 'ENVEOF'\n{env_content}ENVEOF")

    print("=== Stopping old container if any ===")
    run(ssh, f"cd {REMOTE_DIR} && docker compose down 2>/dev/null || true")
    run(ssh, "docker rm -f srpm 2>/dev/null || true")

    print("=== Building and starting (this may take several minutes) ===")
    code, _, _ = run(
        ssh,
        f"cd {REMOTE_DIR} && docker compose up -d --build 2>&1",
        timeout=900,
    )
    if code != 0:
        print("Build failed!", file=sys.stderr)
        ssh.close()
        sys.exit(1)

    print("=== Waiting for health check ===")
    import time
    for i in range(30):
        time.sleep(5)
        code, out, _ = run(ssh, "docker ps --filter name=srpm --format '{{.Status}}'")
        if "healthy" in out.lower() or "(healthy)" in out:
            break
        if i == 29:
            print("Warning: container may still be starting", file=sys.stderr)

    run(ssh, "docker ps --filter name=srpm")
    run(ssh, f"curl -sf http://localhost:{SRPM_PORT}/api/bootstrap | head -c 200 || echo 'API not ready yet'")

    ssh.close()
    print(f"\n=== Deployment complete ===")
    print(f"  URL: http://{HOST}:{SRPM_PORT}")


if __name__ == "__main__":
    main()
