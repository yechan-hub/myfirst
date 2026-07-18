#!/bin/bash
# 빌드 후 웹사이트에 실시간 배포하는 스크립트

echo "==========================================="
echo "🚀 웹사이트에 새 버전을 배포(Vite 빌드 & 업로드)합니다..."
echo "==========================================="

# npm run deploy 실행 (Vite 빌드 후 gh-pages 브랜치 전송)
npm run deploy

echo ""
echo "✅ 웹사이트 배포 완료!"
echo "🔗 주소: https://yechan-hub.github.io/myfirst/"
echo "==========================================="
