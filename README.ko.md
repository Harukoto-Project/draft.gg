<div align="center">

# Draft.GG

리그 오브 레전드의 드래프트(밴 / 픽)를 돕는 웹 도구입니다.<br>
통계 사이트의 수치와 프로 경기의 픽·밴을 조합하여, "다음에 무엇을 픽 / 밴해야 하는지"를 이유와 함께 제안합니다.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)

[개요](#개요) · [주요 기능](#주요-기능) · [동작 방식](#동작-방식) · [설치](#설치) · [설정](#설정) · [개발](#개발) · [기여](#기여) · [라이선스](#라이선스)

[日本語](README.md) · [English](README.en.md) · [한국어](README.ko.md)

</div>

---

## 개요

Draft.GG는 소환사의 협곡(5v5) 드래프트를 돕는 도구입니다. 아군과 상대 팀의 밴·픽을 직접 입력하면, 현재 상황에 맞춰 픽과 밴 후보를 제안합니다.

- 솔로 / 듀오(랭크 게임)와 5인 팀(클래시, 스크림, 대회)을 모두 상정합니다. 팀 사용 시에는 한 명이 조작하고 화면을 공유하는 방식입니다.
- 입력은 웹에서의 수동 입력만 지원합니다. LoL 클라이언트와는 연동하지 않습니다.
- 승패를 단정하는 도구가 아닙니다. 판단 자료로서 수치와 이유를 제시합니다.

## 주요 기능

### 드래프트 보드

- 랭크 게임 형식과 대회 형식(Blue / Red 선택 포함)의 진행 규칙에 따라 밴·픽을 입력합니다.
- 입력 실수를 고칠 수 있도록, 임의의 칸을 나중에 편집할 수 있습니다.
- 챔피언은 일본어 이름과 영어 이름으로 검색할 수 있습니다.

### 제안

다음 요소를 가중치와 함께 합산하여, 픽과 밴 후보를 이유와 함께 제시합니다.

| 요소   | 내용                                             |
| ------ | ------------------------------------------------ |
| 메타   | 현재 패치의 승률과 티어                          |
| 카운터 | 상대 맞라인 픽에 대한 승률                       |
| 시너지 | 아군 픽과의 조합 승률                            |
| 프로   | 주요 리그와 국제 대회에서의 출현율과 승률        |
| 풀     | 플레이어가 잘 다루는 챔피언                      |
| 구성   | 아군의 피해 유형(AD / AP) 편중과 프런트라인 유무 |

경기 수가 적은 요소는 이유에 "샘플 부족"으로 표시합니다. 가중치는 설정 화면(`/settings`)에서 조정할 수 있으며 브라우저에 저장됩니다.

### 기타 화면

| 경로        | 내용                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| `/`         | 모드 선택(솔로 / 팀)과 데이터 업데이트 현황                            |
| `/draft`    | 드래프트 보드와 제안                                                   |
| `/pro`      | 리그·기간별 프로 경기의 채용률·밴률·승률                               |
| `/profiles` | 플레이어와 챔피언 풀. Riot ID로 OP.GG의 사용 기록을 가져올 수 있습니다 |
| `/teams`    | 5명의 등록과 역할 배정                                                 |
| `/settings` | 제안 가중치 조정                                                       |

Discord 로그인은 선택 사항입니다. 로그인하지 않으면 풀·팀·드래프트는 브라우저에 저장됩니다.

## 동작 방식

통계는 정기 배치로 MySQL에 가져오며, 제안은 요청 시점에 외부 서비스에 문의하지 않고 가져온 데이터만으로 계산합니다.

```mermaid
flowchart LR
  ext["외부 데이터<br/>Data Dragon / OP.GG / Oracle's Elixir / Leaguepedia"] --> worker
  worker --> db[("MySQL")]
  db --> api
  browser["브라우저"] --> web
  web -->|"/api"| api
```

| 위치                    | 역할                                                |
| ----------------------- | --------------------------------------------------- |
| `apps/web`              | Next.js(App Router) 화면                            |
| `apps/api`              | Hono 기반 REST API, 인증, 제안 계산                 |
| `apps/worker`           | 정기 배치. 외부 데이터 수집과 집계                  |
| `packages/engine`       | 제안 점수 계산(DB·HTTP에 의존하지 않는 순수 함수)   |
| `packages/db`           | MySQL 연결, Drizzle 스키마와 마이그레이션           |
| `packages/data-sources` | 외부 데이터 어댑터                                  |
| `packages/shared`       | 타입, Zod 스키마, 드래프트 진행 규칙 등의 공통 정의 |
| `deploy/`               | systemd 유닛 템플릿(미검증. 환경에 맞게 조정하세요) |

### 기술 스택

TypeScript / pnpm workspaces + Turborepo / Next.js / Tailwind CSS / TanStack Query / Hono / Drizzle ORM(MySQL) / Better Auth / Vitest / Oxlint·Oxfmt

## 설치

### 요구 사항

- Node.js 24 이상
- pnpm(`package.json`의 `packageManager`에 적힌 버전)
- MySQL(`utf8mb4` 문자 집합으로 만든 데이터베이스)

### 절차

1. 의존성을 설치합니다.

   ```bash
   pnpm install
   ```

2. `.env.example`을 `.env`로 복사하고 `DATABASE_URL`을 설정합니다. 값은 `.env`에만 적고 커밋하지 마세요.

   ```bash
   cp .env.example .env
   ```

3. 데이터베이스에 마이그레이션을 적용합니다.

   ```bash
   pnpm --filter @draftgg/db db:migrate
   ```

4. web / api / worker를 시작합니다.

   ```bash
   pnpm dev
   ```

   web은 `http://localhost:3000`, api는 `127.0.0.1:3001`에서 대기합니다. 브라우저의 API 호출은 web이 동일 출처의 `/api`로 중계합니다.

통계는 worker가 가져옵니다. 챔피언 목록(Data Dragon)은 시작 시와 매일 정해진 시각에, OP.GG와 프로 경기 통계는 매일 정해진 시각의 작업으로 가져오므로 처음에는 통계가 비어 있을 수 있습니다.

## 설정

환경 변수는 저장소 루트의 `.env`에서 설정합니다. 키 이름은 `.env.example`에 있습니다.

| 변수                                                    | 내용                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                          | MySQL 접속 문자열(`mysql://<사용자>:<비밀번호>@<호스트>:<포트>/<데이터베이스 이름>`). api / worker / 마이그레이션이 사용         |
| `API_HOST` / `API_PORT`                                 | api 대기 주소. `API_HOST`가 `127.0.0.1`(또는 `::1`)이 아니면 시작 시 오류가 발생합니다                                           |
| `WEB_PORT`                                              | web 대기 포트(운영 환경의 `next start`가 참조)                                                                                   |
| `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET`                | Discord 로그인용. 공개 URL과 32자 이상의 무작위 문자열                                                                           |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`           | Discord 로그인용. Developer Portal의 OAuth2에서 발급하고, Redirects에 `<BETTER_AUTH_URL>/api/auth/callback/discord`를 등록합니다 |
| `ORACLES_ELIXIR_CSV_URL`                                | 선택. Oracle's Elixir CSV를 직접 링크로 바꿀 때만 설정                                                                           |
| `LEAGUEPEDIA_BOT_USERNAME` / `LEAGUEPEDIA_BOT_PASSWORD` | 선택. Leaguepedia 봇 인증 정보. 설정하지 않으면 픽 순서 보완을 건너뜁니다                                                        |

> [!NOTE]
> Discord 로그인용 변수 4개가 모두 비어 있으면 로그인 없이 동작하고, 일부만 설정하면 시작 시 오류가 발생합니다.

## 개발

CI는 사용하지 않으므로, 변경을 제출하기 전에 로컬에서 확인해 주세요.

| 목적               | 명령                                    |
| ------------------ | --------------------------------------- |
| 타입 검사          | `pnpm typecheck`                        |
| 테스트             | `pnpm test`                             |
| Lint               | `pnpm lint`                             |
| 포맷 / 포맷 확인만 | `pnpm format` / `pnpm format:check`     |
| 빌드               | `pnpm build`                            |
| 마이그레이션 생성  | `pnpm --filter @draftgg/db db:generate` |

## 기여

Issue와 Pull Request를 환영합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요(일본어로 작성되어 있습니다).

## 라이선스

[Apache License 2.0](LICENSE)으로 제공합니다. Copyright 2026 Harukoto Project

## 데이터 출처와 권리 표기

- 데이터 출처: Data Dragon, OP.GG, Oracle's Elixir, Leaguepedia
- OP.GG 등 외부 서비스 데이터의 이용 조건은 이용자가 직접 확인해 주세요.
- 이 서비스는 Riot Games의 승인을 받은 것이 아니며, Riot Games의 견해나 의견을 반영하지 않습니다. League of Legends와 Riot Games는 Riot Games, Inc.의 상표 또는 등록 상표입니다. League of Legends © Riot Games, Inc.
