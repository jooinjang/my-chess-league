# My Chess League

취미 체스 리그 및 토너먼트 관리를 위한 웹 애플리케이션

## 프로젝트 개요

- 사용자 등록 및 관리 (Chess.com 연동 지원)
- 사용자 간 경기 결과 등록
- Chess.com 경기 자동 가져오기
- Glicko-1 기반 레이팅 시스템
- 토너먼트 및 리그 개최/진행/관리 (예정)

## 기술 스택

### Frontend
- React 19 + TypeScript
- Vite (빌드 도구)
- React Router (라우팅)
- Axios (API 클라이언트)

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

### 경기 관리
- 수동 경기 결과 등록 (백/흑 플레이어, 결과, 날짜)
- Chess.com 경기 자동 가져오기:
  - 두 플레이어 선택 후 월별 경기 조회
  - 체크박스로 경기 선택 (전체 선택 가능)
  - 이미 등록된 경기 자동 제외
  - 선택 경기 일괄 등록
- 전체 경기 초기화 (Reset All) - 레이팅도 초기값으로 리셋

### 레이팅 시스템
- Glicko-1 알고리즘 기반
- 경기 등록 시 자동 계산
- Dashboard에서 순위, 전적(승/무/패), 최근 레이팅 변화 표시

## 프로젝트 구조

```
my-chess-league/
├── backend/
│   ├── main.go                 # 서버 진입점
│   ├── config/                 # 설정
│   ├── database/               # DB 연결
│   ├── models/                 # 데이터 모델
│   │   ├── user.go             # 사용자 모델 (ChesscomUsername 포함)
│   │   └── match.go            # 경기 모델 (ChesscomGameID 포함)
│   ├── handlers/               # API 핸들러
│   │   ├── user_handler.go
│   │   ├── match_handler.go
│   │   └── chesscom_handler.go # Chess.com 연동
│   ├── services/               # 비즈니스 로직
│   │   ├── user_service.go
│   │   ├── match_service.go
│   │   ├── glicko_service.go   # 레이팅 계산
│   │   └── chesscom_service.go # Chess.com API 연동
│   ├── routes/                 # 라우트 정의
│   └── middleware/             # 미들웨어
│
└── frontend/
    ├── src/
    │   ├── api/                # API 클라이언트
    │   │   ├── userApi.ts
    │   │   ├── matchApi.ts
    │   │   └── chesscomApi.ts
    │   ├── components/
    │   │   ├── users/
    │   │   │   ├── UserForm.tsx    # 레이팅 카드 선택, Chess.com 검증
    │   │   │   └── UserList.tsx
    │   │   └── matches/
    │   │       ├── MatchForm.tsx
    │   │       ├── MatchList.tsx
    │   │       └── ChesscomImport.tsx  # Chess.com 경기 가져오기
    │   ├── pages/
    │   │   ├── HomePage.tsx    # Dashboard (랭킹, 전적, 레이팅 변화)
    │   │   ├── UsersPage.tsx
    │   │   └── MatchesPage.tsx
    │   └── types/              # TypeScript 타입
    └── ...
```

## API 엔드포인트

### Users
- `GET /api/v1/users` - 전체 사용자 목록
- `GET /api/v1/users/:id` - 사용자 조회
- `POST /api/v1/users` - 사용자 등록
- `PUT /api/v1/users/:id` - 사용자 수정
- `DELETE /api/v1/users/:id` - 사용자 삭제

### Matches
- `GET /api/v1/matches` - 전체 경기 목록
- `POST /api/v1/matches` - 경기 등록 (레이팅 자동 계산)
- `POST /api/v1/matches/bulk` - 경기 일괄 등록
- `DELETE /api/v1/matches` - 전체 경기 삭제 (레이팅 초기화)
- `DELETE /api/v1/matches/:id` - 경기 삭제

### Chess.com 연동
- `GET /api/v1/chesscom/validate/:username` - Chess.com 사용자명 검증
- `GET /api/v1/chesscom/games` - 두 사용자 간 경기 조회
  - Query params: `user1_id`, `user2_id`, `year`, `month`

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

## 데이터 모델

### User
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uint | PK |
| name | string | 이름 (unique) |
| rating | float64 | 현재 레이팅 |
| rating_deviation | float64 | 레이팅 편차 |
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

## 개발 규칙

- 프론트엔드 코드는 `frontend/` 디렉토리에 작성
- 백엔드 코드는 `backend/` 디렉토리에 작성
- API 응답 형식: `{ success: boolean, data?: T, error?: { code, message } }`
- 삭제는 hard delete 사용 (soft delete X)
