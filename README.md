# Text Extractor AI - Figma Plugin

Figma에서 선택한 레이어의 텍스트를 추출하고 AI를 활용해 다국어 번역[프랑스어, 독일어]을 제안하는 플러그인입니다.

![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-purple)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-green)

## ✨ 주요 기능

### 📝 텍스트 추출
- 선택한 프레임/그룹/컴포넌트에서 모든 텍스트 자동 추출
- 수동으로 텍스트 추가 (`+` 버튼 )
- Auto 모드: 선택 변경 시 자동 목록 갱신
- 추출된 텍스트는 캔버스에 빨간 테두리 박스로 하이라이트 표시

### 🔀 텍스트 병합
- 여러 텍스트를 하나로 병합 (문장이 분리된 경우 유용)
- 병합 해제로 원래 상태 복원 가능

### 🔍 리소스 매칭
- 기존 번역 리소스에서 일치하는 항목 자동 검색
- EXACT (완전 일치), PATTERN_MATCH (패턴 일치), PARTIAL (부분 일치) 분류
- 영어, 독일어, 프랑스어 기존 번역 표시

### 🤖 AI 번역 (OpenAI)
- **개별 번역**: 텍스트별 상세 번역 옵션 제공
- **일괄 번역**: 선택된 모든 텍스트 한 번에 번역
- 프랑스어(FR) & 독일어(DE) 번역 지원
- 각 번역 옵션에 뉘앙스 설명 포함
- 컨텍스트 입력으로 번역 품질 향상

### 💾 상태 저장
- 추출된 텍스트 목록이 Figma 파일에 저장됨
- 플러그인을 닫았다 열어도 상태 유지
- API Key는 브라우저 로컬 스토리지에 안전하게 저장

## 🚀 설치 및 실행

### 요구사항
- Node.js (v16 이상 권장)
- Figma Desktop App

### 설치

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/figma-text-extraction-ai-translation.git

# 디렉토리 이동
cd figma-text-extraction-ai-translation

# 의존성 설치
npm install
```

### 빌드

```bash
# 1회 빌드
npm run build

# 개발 모드 (파일 변경 시 자동 빌드)
npm run watch
```

### Figma에서 플러그인 실행

1. Figma Desktop 열기
2. 파일 열기 또는 새 파일 생성
3. `Menu > Plugins > Development > Import plugin from manifest...` 선택
4. 이 프로젝트의 `manifest.json` 파일 선택
5. `Menu > Plugins > Development > Text Extractor AI` 실행

## 📖 사용법

### 기본 사용법

1. **텍스트 추출**: Figma에서 프레임/그룹 선택 → 플러그인이 자동으로 텍스트 추출
2. **수동 추가**: Auto 체크 해제 후, 원하는 요소 선택 → `+` 버튼 클릭
3. **번역 확인**: 텍스트 옆 `T` 버튼 클릭 → 기존 리소스 및 AI 번역 확인
4. **일괄 번역**: 체크박스로 항목 선택 → `일괄 번역` 버튼 클릭

### API Key 설정

1. [OpenAI API Keys](https://platform.openai.com/api-keys)에서 API Key 발급
2. 플러그인 우측 상단 ⚙️ 버튼 클릭
3. API Key 입력 후 저장

## 📁 프로젝트 구조

```
figma-text-extraction-ai-translation/
├── dist/
│   └── code.js          # 빌드된 플러그인 코드
├── src/
│   ├── code.ts          # 플러그인 메인 로직 (Figma API)
│   ├── ui.html          # 플러그인 UI
│   └── resources.ts     # 기존 번역 리소스 (선택사항)
├── manifest.json        # Figma 플러그인 설정
├── package.json
└── tsconfig.json
```

## 🛠 기술 스택

- **TypeScript** - 타입 안전성
- **esbuild** - 빠른 번들링
- **Figma Plugin API** - Figma 통합
- **OpenAI API (GPT-4o-mini)** - AI 번역

