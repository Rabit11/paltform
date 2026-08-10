#!/bin/bash
# 停止并删除容器（不删数据卷 platform_srpm-data）
set -euo pipefail
sudo docker rm -f srpm-18087
echo "容器已删除；数据卷 platform_srpm-data 仍保留"
