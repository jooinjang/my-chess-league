# My Chess League

취미 체스 리그 및 토너먼트 관리를 위한 웹 애플리케이션

## 프로젝트 개요

- 사용자 등록 및 관리 (Chess.com 연동 지원)
- 사용자 간 경기 결과 등록 (모든 경기는 레이팅에 반영)
- Chess.com 경기 자동 가져오기 (개별/일괄)
- Glicko-1 기반 레이팅 시스템
- 리그 개최/진행/관리 (Swiss/Round Robin)
- 토너먼트 개최/진행/관리 (Double Elimination)
- 게임 분석 기능 (Stockfish 17.1 엔진 기반)
- Google Chat 웹훅 알림

## 기술 스택

### Frontend
- React 19 + TypeScript
- Vite (빌드 도구)
- React Router (라우팅)
- Axios (API 클라이언트)
- chess.js (체스 로직)
- Stockfish 17.1 WASM (체스 엔진)
- CSS Variables 기반 디자인 시스템
- 반응형 모바일 UI

### Backend
- Go + Gin (웹 프레임워크)
- GORM (ORM)
- SQLite (데이터베이스)

## 주요 기능

### 사용자 관리
- 이름, 메모, Chess.com 사용자명으로 등록
- 초기 레이팅 카드 선택 방식:
  - 뉴비 (400): 체스 규칙과 기물의 행마법을 막 익힌 단계
  - 초심자 (600): 체스를 조금 알지만, 오프닝이나 전술은 잘 모름
  - 중급자 (800): 주력 오프닝과 전술 개념을 이해
  - 상급자 (1000): 오프닝 이론과 전술에 따른 게임 진행 가능
- Chess.com 사용자명 유효성 검증
- 레이팅 초기화는 유저 삭제 후 재등록으로만 가능

### 경기 관리
- 수동 경기 결과 등록 (백/흑 플레이어, 결과, 날짜)
- 모든 경기는 레이팅에 반영됨
- Chess.com 경기 자동 가져오기:
  - **Import from Chess.com**: 두 플레이어 선택 후 월별 경기 조회/선택 등록
  - **Import All Matches**: 모든 등록 플레이어 간 월별 경기 일괄 수집
  - 이미 등록된 경기 자동 제외
- 전체 경기 초기화 (Reset All) - 레이팅을 각 유저의 초기값으로 리셋
- 레이팅 재계산: 과거 경기 추가 시 전체 레이팅 일관성 보장

### 레이팅 시스템
- Glicko-1 알고리즘 기반
- Dashboard에서 순위, 전적(승/무/패), 최근 레이팅 변화, 연승 표시
- InitialRating/InitialRD 저장으로 정확한 리셋 지원

### 리그 관리
- Swiss/Round Robin 포맷 지원
- 참가자 선택 및 순서 지정 (드래그앤드롭)
- 라운드별 페어링 자동 생성
- 순위표 (standings) 조회
- Chess.com 경기 결과 자동 반영

### 토너먼트 관리
- Double Elimination 포맷 지원
- 참가자 선택 및 시드 순서 지정
- 브라켓 자동 생성
- 라운드 진행 및 결과 등록

### 게임 분석 (Analyze)
- **Stockfish 17.1 WASM 엔진**: 브라우저에서 실행되는 체스 엔진
- **실시간 포지션 분석**: 현재 위치의 평가값 및 최선수 표시
- **전체 게임 분석**: 모든 수에 대한 평가 및 주석 자동 생성
- **평가 바 (Evaluation Bar)**: 현재 형세를 시각적으로 표시
- **평가 그래프 (Evaluation Graph)**: 게임 전체 흐름 시각화
- **수 주석 (Move Annotation)**:
  - `!!` (Brilliant): 승률 10% 이상 개선
  - `!` (Great): 승률 5% 이상 개선
  - `?!` (Inaccuracy): 승률 5% 이상 손실
  - `?` (Mistake): 승률 10% 이상 손실
  - `??` (Blunder): 승률 20% 이상 손실 또는 메이트 허용
- **정확도 계산**: En-Croissant 공식 기반 (103.1668 * exp(-0.04354 * winChanceLoss) - 3.1669 + 1)
- **변형(Variation) 지원**: 수 트리 구조로 대안 수 탐색 가능
- **인터랙티브 보드**: 직접 수를 두며 엔진 피드백 확인
- **실시간 수 피드백 (User Move Feedback)**:
  - 사용자가 보드에서 수를 두면 즉시 분석
  - 수 전/후 포지션을 병렬로 분석하여 정확한 평가 손실 계산
  - 평가 바가 사용자 수에 맞춰 실시간 동기화
  - Review 패널에 사용자 수 정보 표시 (주석, 평가값 변화, 최선수)
- **Game Review 패널**:
  - 오프닝 정보 및 변형 프리뷰
  - Key Moments (중요 수) 목록 및 점프
  - 현재 수 상세 정보 (정확도, CPL, 승률 변화)

### Google Chat 연동
- 새 플레이어 등록 시 알림 전송
- 웹훅 URL 환경변수 설정

### UI/UX 기능
- **CSS 변수 시스템**: 색상, 간격, 그림자 등 디자인 토큰 중앙 관리
- **Toast 알림**: 성공/실패/경고/정보 메시지 표시 (3초 자동 소멸)
- **Skeleton 로딩**: 데이터 로딩 중 스켈레톤 UI 표시
- **모바일 반응형**: 768px 이하에서 햄버거 메뉴, 카드 레이아웃 전환

## 프로젝트 구조

```
my-chess-league/
├── backend/
│   ├── main.go                 # 서버 진입점
│   ├── config/                 # 설정
│   ├── database/               # DB 연결
│   ├── models/                 # 데이터 모델
│   │   ├── user.go             # 사용자 모델 (InitialRating 포함)
│   │   ├── match.go            # 경기 모델
│   │   ├── league.go           # 리그 모델
│   │   └── tournament.go       # 토너먼트 모델
│   ├── handlers/               # API 핸들러
│   │   ├── user_handler.go
│   │   ├── match_handler.go
│   │   ├── chesscom_handler.go # Chess.com 연동 (sync 포함)
│   │   ├── league_handler.go   # 리그 API
│   │   ├── tournament_handler.go # 토너먼트 API
│   │   └── googlechat_handler.go # Google Chat 웹훅
│   ├── services/               # 비즈니스 로직
│   │   ├── user_service.go
│   │   ├── match_service.go    # RecalculateAllRatings 포함
│   │   ├── glicko_service.go   # 레이팅 계산
│   │   ├── chesscom_service.go # Chess.com API 연동
│   │   ├── league_service.go   # 리그 로직
│   │   ├── tournament_service.go # 토너먼트 로직
│   │   └── googlechat_service.go # Google Chat 전송
│   ├── routes/                 # 라우트 정의
│   └── middleware/             # 미들웨어
│
└── frontend/
    ├── public/
    │   └── stockfish/          # Stockfish 17.1 WASM 엔진 파일
    │       ├── sf17_1-7.js
    │       └── sf17_1-7.wasm
    ├── src/
    │   ├── api/                # API 클라이언트
    │   │   ├── userApi.ts
    │   │   ├── matchApi.ts
    │   │   ├── chesscomApi.ts
    │   │   ├── leagueApi.ts
    │   │   └── tournamentApi.ts
    │   ├── components/
    │   │   ├── common/         # 공통 컴포넌트
    │   │   │   ├── Toast.tsx       # Toast 알림 시스템
    │   │   │   ├── Loading.tsx     # Spinner, Skeleton 컴포넌트
    │   │   │   └── index.ts
    │   │   ├── layout/
    │   │   │   ├── Header.tsx      # 네비게이션 (모바일 햄버거 메뉴)
    │   │   │   └── Layout.tsx
    │   │   ├── users/
    │   │   │   ├── UserForm.tsx    # 레이팅 카드 선택, Chess.com 검증
    │   │   │   └── UserList.tsx    # 모바일 카드 레이아웃 지원
    │   │   ├── matches/
    │   │   │   ├── MatchForm.tsx
    │   │   │   ├── MatchList.tsx   # 모바일 카드 레이아웃 지원
    │   │   │   ├── ChesscomImport.tsx  # 개별 경기 가져오기
    │   │   │   └── ChesscomSync.tsx    # 일괄 경기 가져오기
    │   │   ├── chesscom/
    │   │   │   └── ChesscomGamePicker.tsx
    │   │   └── analyze/        # 게임 분석 컴포넌트
    │   │       ├── ChessBoardPanel.tsx # 체스보드 패널
    │   │       ├── MoveList.tsx        # 수 목록 (변형 지원)
    │   │       ├── EvaluationBar.tsx   # 평가 바
    │   │       ├── EvaluationGraph.tsx # 평가 그래프
    │   │       ├── EnginePanel.tsx     # 엔진 설정 패널
    │   │       ├── GameSelector.tsx    # 게임 선택
    │   │       ├── GameReport.tsx      # 게임 보고서
    │   │       ├── GameReviewPanel.tsx # 게임 리뷰 패널 (오프닝, Key moments, 수 피드백)
    │   │       └── MoveAnnotation.tsx  # 수 주석 표시
    │   ├── hooks/              # Custom Hooks
    │   │   ├── useStockfish.ts     # Stockfish 엔진 통신 및 분석
    │   │   └── useChessGame.ts     # 체스 게임 상태 관리 (변형 지원)
    │   ├── utils/              # 유틸리티 함수
    │   │   └── analysisUtils.ts    # 분석 유틸리티 (정확도, 주석 계산)
    │   ├── pages/
    │   │   ├── HomePage.tsx        # Dashboard (랭킹, 최근 매치)
    │   │   ├── UsersPage.tsx
    │   │   ├── MatchesPage.tsx
    │   │   ├── LeaguesPage.tsx     # 리그 목록/생성
    │   │   ├── LeagueDetailPage.tsx # 리그 상세 (페어링, 순위표)
    │   │   ├── TournamentsPage.tsx # 토너먼트 목록/생성
    │   │   ├── TournamentDetailPage.tsx # 토너먼트 상세 (브라켓)
    │   │   └── AnalyzePage.tsx     # 게임 분석 페이지
    │   ├── types/              # TypeScript 타입
    │   │   ├── index.ts            # 공통 타입 (User, Match 등)
    │   │   └── analysis.ts         # 분석 관련 타입
    │   └── index.css           # CSS 변수 정의 (디자인 토큰)
    └── ...
```

## API 엔드포인트

### Users
- `GET /api/v1/users` - 전체 사용자 목록
- `GET /api/v1/users/:id` - 사용자 조회
- `POST /api/v1/users` - 사용자 등록
- `PUT /api/v1/users/:id` - 사용자 수정
- `DELETE /api/v1/users/:id` - 사용자 삭제
- `GET /api/v1/users/:id/matches` - 사용자 경기 목록

### Matches
- `GET /api/v1/matches` - 전체 경기 목록
- `GET /api/v1/matches/:id` - 경기 조회
- `POST /api/v1/matches` - 경기 등록
- `POST /api/v1/matches/bulk` - 경기 일괄 등록
- `DELETE /api/v1/matches` - 전체 경기 삭제 (레이팅 초기화)
- `DELETE /api/v1/matches/:id` - 경기 삭제

### Leagues
- `GET /api/v1/leagues` - 리그 목록
- `GET /api/v1/leagues/:id` - 리그 조회
- `POST /api/v1/leagues` - 리그 생성
- `PUT /api/v1/leagues/:id` - 리그 수정
- `DELETE /api/v1/leagues/:id` - 리그 삭제
- `GET /api/v1/leagues/:id/pairings` - 페어링 목록
- `POST /api/v1/leagues/:id/rounds/next` - 다음 라운드 생성
- `GET /api/v1/leagues/:id/rounds/:roundNo` - 라운드 조회
- `GET /api/v1/leagues/:id/standings` - 순위표
- `POST /api/v1/leagues/:id/pairings/:pairingId/result/chesscom` - Chess.com 결과 반영

### Tournaments
- `GET /api/v1/tournaments` - 토너먼트 목록
- `GET /api/v1/tournaments/:id` - 토너먼트 조회
- `POST /api/v1/tournaments` - 토너먼트 생성
- `DELETE /api/v1/tournaments/:id` - 토너먼트 삭제
- `GET /api/v1/tournaments/:id/bracket` - 브라켓 조회
- `POST /api/v1/tournaments/:id/rounds/next` - 다음 라운드 생성
- `POST /api/v1/tournaments/:id/matches/:matchId/result/chesscom` - Chess.com 결과 반영

### Chess.com 연동
- `GET /api/v1/chesscom/validate/:username` - Chess.com 사용자명 검증
- `GET /api/v1/chesscom/games` - 두 사용자 간 경기 조회
- `POST /api/v1/chesscom/sync` - 월별 전체 경기 동기화

### Analysis (게임 분석)
- `POST /api/v1/matches/:id/analyze` - 경기 전체 분석 (depth, multipv 옵션)
- `GET /api/v1/matches/:id/analysis` - 경기 분석 결과 조회
- `POST /api/v1/analyze/position` - 단일 포지션 분석 (fen, depth)

### Google Chat
- `POST /api/v1/googlechat/send` - 메시지 전송

### Rankings
- `GET /api/v1/rankings` - 레이팅 순위

## 실행 방법

### Backend
```bash
cd backend
go run main.go
# 서버가 http://localhost:8080 에서 실행됨
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# 개발 서버가 http://localhost:5173 에서 실행됨

# 외부 접속 허용 (같은 네트워크)
npm run dev -- --host
```

## 환경변수

### Backend
- `GOOGLE_CHAT_WEBHOOK_URL` - Google Chat 웹훅 URL
- `ALLOWED_ORIGINS` - CORS 허용 오리진 (쉼표 구분)
- `DB_PATH` - SQLite 데이터베이스 파일 경로

## 데이터 모델

### User
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uint | PK |
| name | string | 이름 (unique) |
| rating | float64 | 현재 레이팅 |
| rating_deviation | float64 | 레이팅 편차 |
| initial_rating | float64 | 초기 레이팅 (리셋용) |
| initial_rd | float64 | 초기 RD (리셋용) |
| memo | string | 메모 |
| chesscom_username | *string | Chess.com 사용자명 (unique, nullable) |

### Match
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uint | PK |
| white_player_id | uint | 백 플레이어 FK |
| black_player_id | uint | 흑 플레이어 FK |
| result | string | 결과 (white_win/black_win/draw) |
| played_at | time | 경기 시간 |
| white_rating_before/after | float64 | 백 레이팅 변화 |
| black_rating_before/after | float64 | 흑 레이팅 변화 |
| chesscom_game_id | *string | Chess.com 경기 ID (중복 방지용) |
| pgn | *string | PGN 기보 (분석용, nullable) |

### League
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uint | PK |
| name | string | 리그 이름 |
| format | string | swiss / round_robin |
| status | string | pending / in_progress / completed |
| current_round | int | 현재 라운드 번호 |

### Tournament
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uint | PK |
| name | string | 토너먼트 이름 |
| format | string | double_elimination |
| status | string | pending / in_progress / completed |
| current_round | int | 현재 라운드 번호 |

## 분석 타입 (Frontend)

### MoveAnalysis
| 필드 | 타입 | 설명 |
|------|------|------|
| moveNumber | number | 수 번호 |
| color | 'w' \| 'b' | 색상 |
| san | string | 표준 기보법 (e.g., "e4", "Nf3") |
| fen | string | 수 이후 포지션 |
| evalBefore | number | 수 이전 평가값 (플레이어 기준) |
| evalAfter | number | 수 이후 평가값 (플레이어 기준) |
| evalAfterWhite | number | 수 이후 평가값 (백 기준, 그래프용) |
| mateBeforeWhite? | number | 메이트 거리 (백 기준, optional) |
| mateAfterWhite? | number | 메이트 거리 (백 기준, optional) |
| judgement | MoveJudgement | 수 판정 (brilliant/great/best/good/inaccuracy/mistake/blunder/book/normal) |
| bestMove | string | 엔진 추천 최선수 |
| bestMoveEval | number | 최선수 평가값 |
| evalLoss | number | 평가값 손실 (centipawns) |
| annotation | MoveAnnotation | 수 주석 (!!, !, ?!, ?, ??) |
| annotationReason | string | 주석 이유 설명 |
| pv | string[] | Principal Variation (최선 변형) |
| winChanceBefore? | number | 수 이전 승률 (0-100, 플레이어 기준) |
| winChanceAfter? | number | 수 이후 승률 (0-100, 플레이어 기준) |
| winChanceLoss? | number | 승률 손실 (positive = worse) |
| cpl? | number | Centipawn Loss (플레이어 기준) |
| isBook? | boolean | 오프닝 북 수 여부 |
| openingName? | string | 오프닝 이름 |
| eco? | string | ECO 코드 |
| isKeyMoment? | boolean | 중요 수 여부 |
| swingCp? | number | 평가값 변화 (플레이어 기준) |
| swingWinChance? | number | 승률 변화 (플레이어 기준) |

### UserMoveFeedback (사용자 수 피드백)
| 필드 | 타입 | 설명 |
|------|------|------|
| san | string | 사용자가 둔 수 (SAN 표기) |
| annotation | string \| null | 수 주석 (!!, !, ?!, ?, ??) |
| reason | string | 평가 이유 |
| evalBefore | number | 수 이전 평가값 (centipawns) |
| evalAfter | number | 수 이후 평가값 (centipawns) |
| bestMove | string | 엔진 추천 최선수 |
| bestMoveEval | number | 최선수 평가값 |
| evalAfterWhite? | number | 수 이후 평가값 (백 기준, 평가바용) |
| mateAfterWhite? | number | 메이트 거리 (백 기준, optional) |

### MoveNode (변형 트리)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| move | ChessMove \| null | 수 정보 (루트는 null) |
| fen | string | 해당 수 이후 포지션 |
| children | MoveNode[] | 자식 노드 (첫 번째가 메인 라인) |
| parent | MoveNode \| null | 부모 노드 |
| isMainLine | boolean | 메인 라인 여부 |
| depth | number | 트리 깊이 |

## CSS 변수 (디자인 토큰)

```css
:root {
  /* Background Colors */
  --color-bg-primary: #0f0f1a;
  --color-bg-secondary: #1a1a2e;
  --color-bg-tertiary: #16213e;

  /* Text Colors */
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0a0a0;
  --color-text-muted: #666666;

  /* Accent Colors */
  --color-accent: #4a9eff;
  --color-accent-hover: #3a8eef;

  /* Status Colors */
  --color-success: #4ade80;
  --color-error: #ff4a4a;
  --color-warning: #fbbf24;

  /* Border, Radius, Spacing, Transitions, Z-index 등 */
}
```

## 개발 규칙

- 프론트엔드 코드는 `frontend/` 디렉토리에 작성
- 백엔드 코드는 `backend/` 디렉토리에 작성
- API 응답 형식: `{ success: boolean, data?: T, error?: { code, message } }`
- 삭제는 hard delete 사용 (soft delete X)
- 경기 삭제 시 레이팅 롤백 없음 (전체 삭제 시에만 초기값으로 리셋)
- CSS 색상은 하드코딩 대신 CSS 변수 사용 권장
- Toast 알림으로 사용자 액션 피드백 제공
- 모바일 반응형 고려 (768px 브레이크포인트)

### 분석 기능 관련
- Stockfish WASM 파일은 `frontend/public/stockfish/`에 위치
- 엔진은 브라우저에서 동적 import로 로드 (Vite 정적 분석 회피)
- 평가값은 centipawns 단위 (100 = 1 폰 이점)
- 정확도 계산은 En-Croissant 공식 사용 (승률 기반)
- 변형(Variation)은 수 트리 구조로 관리 (첫 번째 자식이 메인 라인)
- 실시간 수 분석:
  - 수 전/후 포지션을 병렬로 분석 (`Promise.all`)
  - 정확한 평가 손실 계산을 위해 양쪽 포지션 분석 필수
  - 블런더 판정: > 300cp 손실, 미스테이크: > 100cp, 부정확: > 50cp
  - 메이트 스코어는 10000 기준 centipawn으로 변환
- GameReviewPanel 컴포넌트는 사용자 수 피드백과 분석된 수 정보를 모두 표시
