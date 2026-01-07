# My Chess League

취미 체스 리그 및 토너먼트 관리를 위한 웹 애플리케이션입니다.

## 주요 기능

- **플레이어 관리**: 플레이어 등록, 수정, 삭제
- **레이팅 시스템**: Glicko-1 알고리즘 기반 자동 레이팅 계산
- **경기 기록**: 수동 경기 등록 및 Chess.com 경기 자동 가져오기
- **Rated/Unrated 게임**: 레이팅 반영 여부 선택 가능
- **대시보드**: 실시간 랭킹, 전적, 레이팅 변화 확인

## 기술 스택

| Frontend              | Backend       |
| --------------------- | ------------- |
| React 19 + TypeScript | Go + Gin      |
| Vite                  | GORM + SQLite |
| React Router          | RESTful API   |
| Axios                 |               |

## 설치 방법

### 사전 요구사항

- [Node.js](https://nodejs.org/) 20.19+ 또는 22.12+
- [Go](https://golang.org/) 1.23+

### Docker로 한 번에 실행하기 (Frontend + Backend)

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend(API): `http://localhost:8080/api/v1`
  - Frontend에서 접근할 때는 Nginx가 `/api/v1/*`를 백엔드로 프록시하므로 **같은 도메인(3000)에서** API가 호출됩니다.

DB는 기본으로 compose 볼륨(`backend_data`)에 저장됩니다. 로컬의 기존 `backend/chess_league.db`를 그대로 쓰고 싶으면 `docker-compose.yml`의 주석 처리된 바인드 마운트 옵션을 사용하세요.

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

### 외부 접속 허용 (같은 네트워크)

외부 기기에서 접근하려면 **백엔드는 0.0.0.0 바인드**, **프론트는 API 주소를 localhost로 고정하지 않기**가 중요합니다.

- **Backend**:

```bash
cd backend
HOST=0.0.0.0 PORT=8080 go run main.go
```

- **Frontend (dev 서버)**:

```bash
cd frontend
npm run dev -- --host
```

#### 환경변수 (중요)

- **Backend**

  - `HOST`: 바인드 주소. 외부 접속 허용 시 `0.0.0.0`
  - `PORT`: 포트 (기본 8080)
  - `DB_PATH`: SQLite DB 파일 경로 (기본 `chess_league.db`)
    - 실행 위치가 달라져도 기존 DB를 잡도록 `./chess_league.db` → 없으면 `./backend/chess_league.db`를 우선 탐색합니다.
  - `CORS_ALLOW_ALL`: `true`면 Origin 제한 없이 허용(개발/내부망용)
  - `CORS_ALLOW_ORIGINS`: 추가 허용 Origin 목록(쉼표 구분) 예: `http://192.168.0.10:5173,http://localhost:5173`
  - `GOOGLE_CHAT_WEBHOOK_URL`: Google Chat Incoming Webhook URL (메시지 발송)
    - 예: `https://chat.googleapis.com/v1/spaces/<SPACE_ID>/messages?key=...&token=...`

- **Frontend**
  - `VITE_API_URL`: 백엔드 API baseURL
    - 권장(리버스프록시/동일 오리진): `/api/v1`
    - 개발(분리 실행): `http://<내IP>:8080/api/v1`

## Google Chat 알림 연동 (Incoming Webhook 발송)

이 프로젝트는 **우리 API가 호출되면 Google Chat 스페이스로 메시지를 발송**할 수 있습니다.

### 1) Incoming Webhook URL 준비

Google Chat에서 스페이스에 Incoming Webhook을 만들고, 아래 환경변수로 설정합니다:

- `GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=..."`

> 주의: 이 URL은 비밀값입니다. 저장소/문서에 커밋하지 마세요.

### 2) 서버 실행

```bash
cd backend
GOOGLE_CHAT_WEBHOOK_URL="<YOUR_WEBHOOK_URL>" PORT=8080 go run main.go
```

### 3) 메시지 발송 API 호출

- 엔드포인트: `POST /api/v1/googlechat/send`

```bash
curl -i -X POST http://localhost:8080/api/v1/googlechat/send \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hi"}'
```

정상이라면 `{"success":true}`가 반환되고, 스페이스에 메시지가 올라갑니다.

### Frontend 개발 서버 실행

```bash
cd frontend
npm run dev
```

개발 서버가 `http://localhost:5173`에서 실행됩니다.

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
4. **Rated Game** 체크박스로 레이팅 반영 여부 선택
   - 체크: 레이팅에 반영됩니다
   - 해제: 레이팅에 반영되지 않습니다 (친선 경기 등)
5. **Record Match** 클릭

#### Chess.com 경기 가져오기

1. **Matches** 페이지에서 **Import from Chess.com** 클릭
2. Chess.com 계정이 등록된 두 플레이어 선택
3. 월 선택 후 **Search Games** 클릭
4. 가져올 경기 체크박스 선택 (또는 Select All)
5. **Rated Game** 체크박스로 레이팅 반영 여부 선택
6. **Import** 클릭

### 3. 대시보드 확인

- **Dashboard** 페이지에서 전체 랭킹 확인
- 각 플레이어별 레이팅, 전적(승/무/패), 최근 레이팅 변화 표시

### 4. 데이터 초기화

- **Matches** 페이지에서 **Reset All** 클릭
- 모든 경기 기록 삭제 (레이팅은 유지됨)
- 레이팅 초기화가 필요하면 유저를 삭제 후 재등록

## 스크린샷

```
┌─────────────────────────────────────────────────┐
│  My Chess League                                 │
├─────────────────────────────────────────────────┤
│  Dashboard                                       │
├─────────────────────────────────────────────────┤
│  #1  Player A    1050  (5W/1D/2L)    +15        │
│  #2  Player B    980   (4W/2D/3L)    -8         │
│  #3  Player C    920   (3W/1D/4L)    +12        │
└─────────────────────────────────────────────────┘
```

## API 문서

### Users

| Method | Endpoint            | 설명             |
| ------ | ------------------- | ---------------- |
| GET    | `/api/v1/users`     | 전체 사용자 목록 |
| POST   | `/api/v1/users`     | 사용자 등록      |
| PUT    | `/api/v1/users/:id` | 사용자 수정      |
| DELETE | `/api/v1/users/:id` | 사용자 삭제      |

### Matches

| Method | Endpoint               | 설명                                           |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/v1/matches`      | 전체 경기 목록                                 |
| POST   | `/api/v1/matches`      | 경기 등록 (rated 필드로 레이팅 반영 여부 지정) |
| POST   | `/api/v1/matches/bulk` | 경기 일괄 등록                                 |
| DELETE | `/api/v1/matches`      | 전체 경기 삭제 (레이팅 유지)                   |
| DELETE | `/api/v1/matches/:id`  | 경기 삭제                                      |

### Chess.com

| Method | Endpoint                              | 설명                   |
| ------ | ------------------------------------- | ---------------------- |
| GET    | `/api/v1/chesscom/validate/:username` | 사용자명 검증          |
| GET    | `/api/v1/chesscom/games`              | 두 사용자 간 경기 조회 |

### Rankings

| Method | Endpoint           | 설명        |
| ------ | ------------------ | ----------- |
| GET    | `/api/v1/rankings` | 레이팅 순위 |

### Google Chat

| Method | Endpoint                  | 설명                         |
| ------ | ------------------------- | ---------------------------- |
| POST   | `/api/v1/googlechat/send` | Incoming Webhook 메시지 발송 |

## 라이선스

MIT License
