#!/bin/bash
# 只停平台容器，不删数据卷，不动 8092。
set -euo pipefail
NAME="${CONTAINER_NAME:-srpm-18087}"
docker rm -f "$NAME"
echo "已停止 $NAME；数据卷 platform_srpm-data 仍在。8092 未动。"
