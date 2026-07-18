#!/bin/bash
# 로컬 변경사항을 GitHub main 브랜치에 업로드(백업)하는 스크립트

echo "==========================================="
echo "💾 원본 코드를 GitHub에 업로드(백업)합니다..."
echo "==========================================="

# 1. 모든 변경된 파일 추가
git add .

# 2. 커밋 메시지 입력 받기 (입력하지 않으면 기본 메시지 사용)
read -p "커밋 메시지를 입력하세요 (엔터 누르면 'Update code'로 지정): " commit_msg
if [ -z "$commit_msg" ]; then
  commit_msg="Update code"
fi

# 3. 커밋 생성
git commit -m "$commit_msg"

# 4. 푸시 실행
git push origin main

echo ""
echo "✅ GitHub 업로드 완료!"
echo "==========================================="
