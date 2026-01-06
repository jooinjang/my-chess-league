# My Chess League

취미 체스 리그 및 토너먼트 관리를 위한 웹 애플리케이션입니다.

## 주요 기능

- **플레이어 관리**: 플레이어 등록, 수정, 삭제
- **레이팅 시스템**: Glicko-1 알고리즘 기반 자동 레이팅 계산
- **경기 기록**: 수동 경기 등록 및 Chess.com 경기 자동 가져오기
- **대시보드**: 실시간 랭킹, 전적, 레이팅 변화 확인

## 기술 스택

| Frontend | Backend |
|----------|---------|
| React 19 + TypeScript | Go + Gin |
| Vite | GORM + SQLite |
| React Router | RESTful API |
| Axios | |

## 설치 방법

### 사전 요구사항

- [Node.js](https://nodejs.org/) 20.x 이상
- [Go](https://golang.org/) 1.21 이상

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/my-chess-league.git
cd my-chess-league
```

### 2. Backend 설정

```bash
cd backend
go mod tidy
```

### 3. Frontend 설정

```bash
cd frontend
npm install
```

## 실행 방법

### Backend 서버 실행

```bash
cd backend
go run main.go
```
서버가 `http://localhost:8080`에서 실행됩니다.

### Frontend 개발 서버 실행

```bash
cd frontend
npm run dev
```
개발 서버가 `http://localhost:5173`에서 실행됩니다.

### 외부 접속 허용 (같은 네트워크)

```bash
npm run dev -- --host
```

## 사용 가이드

### 1. 플레이어 등록

1. 상단 네비게이션에서 **Users** 클릭
2. **+ Add User** 버튼 클릭
3. 정보 입력:
   - **Name**: 플레이어 이름
   - **Initial Rating**: 실력에 맞는 레이팅 카드 선택
     - 뉴비 (400): 체스 규칙을 막 익힌 단계
     - 초심자 (600): 기본적인 체스 지식 보유
     - 중급자 (800): 오프닝과 전술 개념 이해
     - 상급자 (1000): 이론과 전술에 따른 게임 진행 가능
   - **Chess.com Username** (선택): Chess.com 계정 연동 시 입력 후 Validate 클릭
   - **Memo** (선택): 플레이어 소개
4. **Create User** 클릭

### 2. 경기 등록

#### 수동 등록
1. 상단 네비게이션에서 **Matches** 클릭
2. **+ Record Match** 버튼 클릭
3. 백/흑 플레이어, 결과, 경기 시간 선택
4. **Record Match** 클릭

#### Chess.com 경기 가져오기
1. **Matches** 페이지에서 **Import from Chess.com** 클릭
2. Chess.com 계정이 등록된 두 플레이어 선택
3. 월 선택 후 **Search Games** 클릭
4. 가져올 경기 체크박스 선택 (또는 Select All)
5. **Import** 클릭

### 3. 대시보드 확인

- **Dashboard** 페이지에서 전체 랭킹 확인
- 각 플레이어별 레이팅, 전적(승/무/패), 최근 레이팅 변화 표시

### 4. 데이터 초기화

- **Matches** 페이지에서 **Reset All** 클릭
- 모든 경기 삭제 및 플레이어 레이팅 초기값으로 리셋

## 스크린샷

```
┌─────────────────────────────────────────────────┐
│  Dashboard                                       │
├─────────────────────────────────────────────────┤
│  #1  Player A    1050  (5W/1D/2L)    +15        │
│  #2  Player B    980   (4W/2D/3L)    -8         │
│  #3  Player C    920   (3W/1D/4L)    +12        │
└─────────────────────────────────────────────────┘
```

## API 문서

### Users
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/users` | 전체 사용자 목록 |
| POST | `/api/v1/users` | 사용자 등록 |
| PUT | `/api/v1/users/:id` | 사용자 수정 |
| DELETE | `/api/v1/users/:id` | 사용자 삭제 |

### Matches
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/matches` | 전체 경기 목록 |
| POST | `/api/v1/matches` | 경기 등록 |
| POST | `/api/v1/matches/bulk` | 경기 일괄 등록 |
| DELETE | `/api/v1/matches` | 전체 경기 삭제 |
| DELETE | `/api/v1/matches/:id` | 경기 삭제 |

### Chess.com
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/chesscom/validate/:username` | 사용자명 검증 |
| GET | `/api/v1/chesscom/games` | 두 사용자 간 경기 조회 |

### Rankings
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/rankings` | 레이팅 순위 |

## 라이선스

MIT License
