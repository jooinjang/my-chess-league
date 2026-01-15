FROM golang:1.23-bookworm AS build

WORKDIR /src

# sqlite (gorm sqlite driver -> mattn/go-sqlite3) 는 CGO가 필요합니다.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Docker Desktop(Apple Silicon)에서는 기본 타겟이 linux/arm64 입니다.
# GOARCH를 amd64로 강제하면 CGO(sqlite) 빌드 시 gcc가 -m64를 처리 못해 실패합니다.
# 컨테이너의 현재 아키텍처(=타겟)로 빌드합니다.
RUN CGO_ENABLED=1 go build -o /out/server .


# Build Stockfish 17.1 from source
FROM debian:bookworm-slim AS stockfish-build

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    g++ \
    make \
    git \
    wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /stockfish
RUN git clone --depth 1 --branch sf_17.1 https://github.com/official-stockfish/Stockfish.git . \
  && cd src \
  && make -j$(nproc) build ARCH=armv8


FROM debian:bookworm-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libsqlite3-0 \
  && rm -rf /var/lib/apt/lists/*

# Copy Stockfish 17.1 binary from build stage
COPY --from=stockfish-build /stockfish/src/stockfish /usr/games/stockfish

WORKDIR /app
COPY --from=build /out/server /app/server

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DB_PATH=/data/chess_league.db

VOLUME ["/data"]
EXPOSE 8080

ENTRYPOINT ["/app/server"]


