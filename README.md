# ⚡ 실시간 20초 클릭 배틀 (Click Battle)

> 고등학생 40명을 대상으로 한 아케이드 감성의 실시간 20초 초고속 클릭 배틀 웹 애플리케이션입니다.  
> Next.js (App Router), Tailwind CSS, Supabase Realtime(Broadcast)으로 구축되었으며 Vercel에 원클릭 배포할 수 있습니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChanhuiSeok%2Fclickable&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

---

## 🎮 페이지 구성 및 주요 기능

### 1. 📱 모바일 뷰 (학생용) - `/`
- **닉네임 및 아바타 선택**: 원하는 이모지 아바타와 닉네임(2~10자)을 정하고 대기실 입장
- **대기실 모드**: 발표자가 게임을 시작할 때까지 실시간 대기 및 팁 안내
- **3초 카운트다운**: 3, 2, 1 긴장감 넘치는 비프음과 카운트다운
- **20초 광클릭 배틀**:
  - 화면을 꽉 채우는 대형 터치 버튼 (`👊 TAP!`)
  - 터치할 때마다 **햅틱 진동(`navigator.vibrate`)** 및 레트로 아케이드 타격 효과음(Web Audio API)
  - **배치 전송 최적화**: 200ms마다 누적 클릭 수를 묶어서(batch) Supabase Broadcast로 전송하여 네트워크 부하 최소화
  - **치팅(매크로) 방지**: 70 CPS(초당 70회) 이상 비정상 연타 감지 시 해당 배치 무시 및 경고 안내
- **결과 화면**: 20초 종료 시 내 최종 클릭 수 및 최고 CPS 확인

### 2. 📺 프로젝터 뷰 (발표자용) - `/screen`
- **대형 스크린 / 전자칠판 최적화**: 네온 글로우와 사이버펑크 아케이드 다크모드 UI
- **접속용 QR 코드 및 주소 복사**: 학생들이 스마트폰 카메라로 즉시 접속할 수 있는 대형 QR코드
- **참가자 실시간 감지**: 접속한 학생들의 닉네임 뱃지가 실시간으로 대기실에 등록 (최대 40명 수용)
- **[게임 시작] 버튼 & 스페이스바(SPACE) 단축키**: 3초 카운트다운 후 20초 게임 일괄 시작 브로드캐스트 발송
- **실시간 1~40등 2단 컬럼 순위표**:
  - **좌측 컬럼**: 1등 ~ 20등 (Champion Bracket)
  - **우측 컬럼**: 21등 ~ 40등 (Challenger Bracket)
  - 1, 2, 3위 황금/은/동 뱃지 및 점수 비율 게이지, 실시간 CPS 표시
- **종료 시상식 및 폭죽**:
  - 20초 종료 휘슬과 함께 1, 2, 3위 입체 포디엄(시상대) 연출
  - `canvas-confetti` 화려한 축하 폭죽 발사
  - **[새 게임 시작 (RESET)]** 버튼 클릭 시 모든 학생 화면도 대기실로 자동 초기화

---

## 🛠️ 기술 스택 및 아키텍처

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 (Custom Neon & Arcade Dark Theme)
- **Realtime Networking**:
  - **Supabase Realtime Broadcast & Presence**: DB 영구 저장 없이 메모리 기반 초고속 브로드캐스트 채널 통신
  - **Local Broadcast Fallback**: Supabase 환경변수가 없어도 브라우저 `BroadcastChannel` API를 통해 로컬에서 완벽 시뮬레이션 지원
- **Effects & UI**:
  - `canvas-confetti`: 우승자 시상 폭죽
  - `qrcode.react`: 접속 QR 코드
  - `lucide-react`: 아케이드 아이콘
  - **Web Audio API Engine**: 외부 음원 다운로드 없이 브라우저 네이티브 신디사이저로 생성하는 8-bit 효과음

---

## 🚀 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (선택 사항 - 미설정 시 로컬 데모 모드로 작동)
cp .env.example .env.local

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 접속:
- 학생 화면: `http://localhost:3000/`
- 발표자 스크린: `http://localhost:3000/screen`

---

## 🌐 Supabase Realtime 설정 (Vercel 배포 시 권장)

1. [Supabase](https://supabase.com)에 로그인 후 새 프로젝트를 생성합니다.
2. 프로젝트 대시보드 -> **Project Settings** -> **API** (또는 **API Keys**) 메뉴로 이동합니다.
3. 다음 두 값을 복사합니다:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable Key** (최신 대시보드) 또는 `anon public` key (기존 대시보드) -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   > ⚠️ **주의**: `Secret key` (구 `service_role` key)는 서버 전용 비공개 키이므로 클라이언트 애플리케이션에 절대로 입력하지 마세요! 브라우저/클라이언트에는 반드시 **Publishable Key**를 사용해야 합니다.
4. 별도의 SQL 테이블 생성은 전혀 필요하지 않습니다! (Realtime Broadcast & Presence만 사용)
5. Vercel 배포 시 환경 변수에 등록하면 전 세계 어디서든 학생들이 스마트폰으로 동시 접속할 수 있습니다.

---

## 📄 라이선스
MIT License
