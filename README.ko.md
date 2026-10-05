# motion-studio

[English](README.md) | **한국어**

주제, 개요, 문서를 입력하면 다음 결과물을 만들어 주는 Claude Code 플러그인입니다.

- **모션 그래픽 영상** (MP4, 1080p, [Remotion](https://remotion.dev)으로 렌더링)
- **HTML 슬라이드**: 슬라이드별 애니메이션을 그대로 재생하는 단일 파일. `--html-audio`를 쓰면 내레이션이 함께 들어가며, 처음에는 소리 없이 열리고 재생 버튼을 눌러야 소리가 납니다. M 키로 음소거를 켜고 끕니다
- **편집 가능한 PowerPoint** (.pptx): 네이티브 텍스트, 차트, 발표자 노트 포함
- **PDF** 배포 자료
- **대본** (타임스탬프가 붙은 Markdown)과 **자막** (SRT. 음성 내레이션이 없으면 영상에 자막을 입힘)
- 슬라이드별 **주석**: 출처와 각주를 슬라이드에 작게 표시하고, HTML/PPTX에서는 링크로 연결하며, 대본에도 정리
- 선택 사항인 **내레이션**: 로컬 오픈소스 TTS [Supertonic](https://github.com/supertone-inc/supertonic) 사용 (빠른 초안은 macOS `say`). 한국어 문장 속 영어 용어처럼 여러 언어가 섞인 문장의 발음도 처리
- 선택 사항인 **이미지 생성**: 교체 가능한 이미지 제공자 인터페이스. 현재는 OpenAI `gpt-image-2.5` (flare/sunburst) 지원

모든 결과물이 하나의 `deck.json`에서 만들어지므로 슬라이드, 대본, 영상의 내용이 어긋나지 않습니다.

## 쇼케이스

[`examples/`](examples/)의 예제 덱을 `motionstudio stills`로 렌더링한 정지 화면입니다. 영상과 HTML 덱에서는 모든 요소가 애니메이션으로 등장합니다.

<table>
  <tr>
    <td width="50%"><img src="docs/images/slides/expressive-title.jpg" alt="midnight 테마의 expressive 스타일 타이틀 슬라이드"><br><sub><b>Expressive</b> 스타일, <code>midnight</code> 테마: 그라디언트 제목, 글로우, 움직이는 배경 (<code>showcase</code>)</sub></td>
    <td width="50%"><img src="docs/images/slides/minimal-title.png" alt="minimal 스타일 타이틀 슬라이드"><br><sub><b>Minimal</b> 스타일, <code>minimal</code> 테마: 에디토리얼 정렬, 강조색 하나, 차분한 모션 (<code>minimal</code>)</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/slides/chart.jpg" alt="막대 차트 슬라이드"><br><sub><code>chart</code>: 막대가 자라고 숫자가 올라가는 애니메이션. PowerPoint에는 편집 가능한 네이티브 차트로 내보냄</sub></td>
    <td><img src="docs/images/slides/svg-visual.png" alt="SVG 허브 다이어그램과 옆의 글머리표"><br><sub><code>visual</code>: Claude가 그린 SVG 다이어그램이 단계별로 그려지고, 옆에 설명이 붙음</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/slides/cards.png" alt="SVG 아이콘이 있는 카드 세 장"><br><sub><code>cards</code>: 테마 색을 따르는 SVG 아이콘</sub></td>
    <td><img src="docs/images/slides/timeline.jpg" alt="타임라인 슬라이드"><br><sub><code>timeline</code>: 선이 그어지고 마일스톤이 하나씩 나타남</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/slides/generated-image.jpg" alt="제목이 있는 전체 화면 생성 이미지"><br><sub><code>image</code>: <code>gpt-image-2.5</code>로 생성한 이미지와 느린 켄 번스 줌 (<code>generated-images</code>)</sub></td>
    <td><img src="docs/images/slides/korean-title.jpg" alt="paper 테마의 한국어 타이틀 슬라이드"><br><sub><code>paper</code> 테마의 한국어 덱, Supertonic 내레이션 (<code>korean</code>)</sub></td>
  </tr>
</table>

### SVG 비주얼

Claude는 다이어그램, 일러스트, 아이콘을 테마 색상 토큰(`var(--accent)`, `var(--text)` 등)을 쓴 SVG로 그립니다. 그래서 파일 하나가 모든 테마에서 동작합니다. 아래는 [`examples/minimal/assets/`](examples/minimal/assets/)의 SVG를 `minimal`과 `minimal-dark` 색으로 표시한 것입니다 (GitHub의 라이트/다크 설정을 따라갑니다).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/diagrams/flow-dark.svg">
  <img src="docs/images/diagrams/flow-light.svg" alt="4단계 파이프라인 다이어그램: Capture, Structure, Render, Ship" width="100%">
</picture>

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/diagrams/hub-dark.svg">
  <img src="docs/images/diagrams/hub-light.svg" alt="허브 다이어그램: 가운데 deck.json이 MP4, PPTX, HTML, PDF, SRT와 연결됨" width="49%">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/diagrams/layers-dark.svg">
  <img src="docs/images/diagrams/layers-light.svg" alt="차분한 인터페이스를 표현한 추상 그림: 겹친 패널과 강조 요소 하나" width="49%">
</picture>
</p>

덱 안에서는 `data-step`으로 묶은 그룹이 내레이션 순서대로 그려집니다. 선이 먼저 그려지고, 이어서 채우기와 텍스트가 나타납니다.

## 설치

GitHub에서 설치 (비공개 저장소이므로 `git`/`gh` 로그인 계정에 접근 권한이 있어야 합니다):

```bash
claude plugin marketplace add hjs-gith/motion-studio
claude plugin install motion-studio@motion-studio-marketplace
```

로컬 클론에서 설치하려면 `claude plugin marketplace add /path/to/motion-studio`를 실행한 뒤 같은 `install` 명령을 쓰면 됩니다. 새 버전을 받으려면 `claude plugin update motion-studio@motion-studio-marketplace`를 실행하고 Claude Code를 다시 시작하세요.

그다음 Claude Code 세션에서:

```
/motion-studio:setup                  # 렌더링 엔진 설치 (최초 1회, 1~2분)
/motion-studio:setup supertonic       # 선택: 내레이션
/motion-studio:create 면역계가 백신으로 학습하는 원리를 설명하는 3분짜리 영상, 내레이션 포함
```

또는 그냥 *"./notes.md로 내 앱 소개 발표 자료와 영상을 만들어 줘"*처럼 요청해도 됩니다. `create` 스킬이 알아서 실행됩니다.

## 스킬

| 스킬 | 하는 일 |
|---|---|
| `/motion-studio:create` | 개요 → 자료 조사 → 구성안 → deck.json → 검증 → 정지 화면 검토 → TTS → 렌더링 |
| `/motion-studio:render` | 기존 덱을 다시 렌더링 (전체 또는 일부 형식, 초안 또는 최종본) |
| `/motion-studio:setup` | 엔진과 Supertonic TTS 설치 및 점검 |

## CLI

플러그인은 Claude의 PATH에 `motionstudio`를 추가합니다 (`plugins/motion-studio/bin/`). 직접 실행해도 됩니다.

```bash
motionstudio init my-talk --title "My Talk" --theme minimal
motionstudio validate my-talk          # 스키마 검사, 린트, 슬라이드별 시간
motionstudio stills my-talk            # 모든 슬라이드의 PNG → my-talk/out/stills/
motionstudio tts my-talk --preview     # 실제로 읽힐 문장 확인 (lexicon, 약어, ⟦en: …⟧ 구간)
motionstudio tts my-talk               # 내레이션 → my-talk/assets/audio/
motionstudio images my-talk            # 생성할 이미지 계획 확인 (과금 없음)
motionstudio images my-talk --yes      # 이미지 생성 (유료, OPENAI_API_KEY 필요)
motionstudio render my-talk            # video, html, pptx, pdf, script
motionstudio render my-talk --formats video --draft
motionstudio render my-talk --no-voice # 음성 없이: 자막을 입힌 무음 영상
motionstudio themes | schema | doctor
```

## 덱 프로젝트 구조

```
my-talk/
  deck.json          # 모든 결과물의 원본
  assets/            # 이미지, 음악. audio/에는 생성된 내레이션이 저장됨
  out/               # my-talk.mp4 .html .pptx .pdf -script.md .srt, stills/
```

**레이아웃 18종:** `title`, `section`, `agenda`, `bullets`, `cards`, `statement`, `quote`, `big-number`, `stat`, `chart` (bar/line/donut), `visual` (애니메이션 SVG), `image`, `image-text`, `split`, `comparison`, `timeline`, `code`, `end`.

**스타일 2종, 테마 8종.** `minimal` 스타일(단색 강조, 가는 선, 에디토리얼 정렬, 차분한 모션)은 `minimal`, `minimal-dark`, `swiss`, `corporate` 테마에서 씁니다. `expressive` 스타일(그라디언트, 글로우, 탄력 있는 모션)은 `midnight`, `aurora`, `noir`, `paper` 테마에서 씁니다. 어떤 테마든 `theme.style`로 스타일을 바꿀 수 있고 색상과 글꼴도 덮어쓸 수 있으므로, Claude에게 말로 요청해서 덱의 디자인을 바꿀 수 있습니다.

**SVG 비주얼.** Claude는 다이어그램, 일러스트, 아이콘을 테마 색상 토큰을 쓴 SVG로 그립니다. 영상과 HTML 덱에서는 `data-step` 순서대로 그려지는 애니메이션이 적용되고, 테마에 맞춰 색이 바뀌며, PPTX/PDF에는 선명한 PNG로 변환되어 들어갑니다 ([쇼케이스](#svg-비주얼) 참고).

전환 효과: `fade`, `slide`, `wipe`, `flip`, `clock-wipe`, `iris`.

전체 형식은 [`skills/create/reference/deck-spec.md`](plugins/motion-studio/skills/create/reference/deck-spec.md), SVG 작성법은 [`svg-visuals.md`](plugins/motion-studio/skills/create/reference/svg-visuals.md)를 참고하세요. [`examples/`](examples/)에는 예제 덱이 있습니다: `minimal` (새 레이아웃과 SVG 다이어그램), `showcase` (expressive, 내레이션 포함), `korean` (여러 언어가 섞인 내레이션), `generated-images` (이미지 생성. 키를 설정하기 전에는 임시 이미지 표시).

## 이미지 생성

`image`, `image-text` 슬라이드나 `split`의 열에 `"generate": { "prompt": "…" }`를 추가합니다. 이미지가 만들어지기 전에는 테마 색의 임시 이미지가 표시되므로 레이아웃은 비용 없이 검토할 수 있습니다. `motionstudio images`는 생성 계획만 보여 주고, `--yes`를 붙여야 실제로 생성합니다. 결과는 프롬프트, 스타일, 모델, 품질, 크기를 기준으로 캐시되므로 같은 이미지에 두 번 과금되지 않습니다. OpenAI를 쓰려면 키를 직접 설정하세요.

```bash
echo 'export OPENAI_API_KEY=sk-...' >> ~/.zshrc
```

(또는 `~/.claude/settings.json`에 `"env": { "OPENAI_API_KEY": "…" }`를 추가). 이미지 제공자는 `engine/src/images/`에 있으며, Gemini, Recraft, FLUX를 추가하려면 `ImageProvider` 하나를 구현하면 됩니다. [`images.md`](plugins/motion-studio/skills/create/reference/images.md)를 참고하세요.

## 주석과 음성 없는 덱

각 슬라이드에는 `annotations`를 넣을 수 있습니다. 출처나 각주를 짧게 적는 줄(`"Source: OECD, Education at a Glance (2024)"` 또는 `{ "text": "…", "url": "…" }`)로, 슬라이드 아래 여백에 표시되고 HTML과 PPTX에서는 링크로 동작합니다.

내레이션 음성은 선택 사항입니다. `voice.engine: "none"`(기본값)이어도 내레이션 텍스트로 슬라이드 시간을 정하고, 영상에는 자막(화면 자막과 SRT)으로, HTML 덱(N 키)과 PPTX에는 발표자 노트로, 그리고 대본으로 들어갑니다. 음성이 있는 덱도 `motionstudio render <dir> --no-voice`로 같은 무음 버전을 만들 수 있습니다. [`deck-spec.md`](plugins/motion-studio/skills/create/reference/deck-spec.md)를 참고하세요.

## 여러 언어가 섞인 내레이션

한국어 내레이션은 **속도도 고르게** 맞춥니다. 문장을 하나씩 합성한 뒤 기준 속도에 맞춰 다시 합성하므로, 짧은 문장이 급하게 읽히거나 긴 문장이 늘어지지 않습니다 (`voice.pace`, 기본값 켜짐).

Supertonic은 한 번 호출할 때 한 언어로만 읽습니다. 그래서 합성 전에 `voice.lexicon`의 발음 표기(`"Prompt": "프롬프트"`), 약어 읽기(AI → 에이아이), 영어 구간 분리를 **음성에만** 적용합니다. 슬라이드와 자막에는 원래 텍스트가 그대로 남습니다. [`voices.md`](plugins/motion-studio/skills/create/reference/voices.md)를 참고하세요.

## 동작 방식

```
plugins/motion-studio/
  .claude-plugin/plugin.json
  bin/motionstudio            # 실행기: 엔진을 ~/.cache/motion-studio에 설치하고 명령을 전달
  skills/                     # create / render / setup (+ 참고 문서)
  engine/
    src/spec.ts               # deck.json의 zod 스키마
    src/timeline.ts           # 시간 계산: 내레이션 기반 슬라이드 길이, 전환, 자막
    src/video/                # Remotion 컴포지션, 레이아웃, 모션 기본 요소, 배경
    src/video/look.ts         # 모든 레이아웃이 쓰는 스타일 토큰 (minimal / expressive)
    src/video/SvgVisual.tsx   # 프레임 기반 SVG 그리기 애니메이션
    src/svg-utils.ts          # SVG 정리, 테마 토큰 치환, 비율/키 계산
    src/images/               # 이미지 제공자 인터페이스, OpenAI 제공자, 임시 이미지, 작업 계획/캐시
    src/pronounce.ts          # TTS 발음 처리: lexicon, 약어, 언어 구간
    src/export/               # pptx (pptxgenjs), pdf (pdf-lib), html (esbuild + @remotion/player), script/srt
    src/cli/                  # CLI, Remotion 번들링/렌더링, TTS 실행
    tts/synth.py              # Supertonic 일괄 합성 워커
```

- 슬라이드 길이 = 레이아웃 최소 시간과 (내레이션 음성 + 앞뒤 여유 + 전환 시간) 중 긴 쪽. 음성이 없으면 예상 낭독 시간을 쓰므로 무음 영상도 대본에 맞는 속도로 진행됩니다.
- TTS 결과는 텍스트와 음성 설정의 해시로 슬라이드별 캐시되며, 바뀐 슬라이드만 다시 합성합니다.
- 엔진은 자체 디렉터리에서 실행되므로 Remotion의 헤드리스 Chrome은 그곳에 캐시되고, 사용자 프로젝트 안에는 설치되지 않습니다.

## 개발

이 로컬 마켓플레이스에서 플러그인을 설치하면 Claude Code는 이 폴더를 그대로 읽습니다. `plugins/motion-studio/engine/node_modules`가 있으면 실행기도 엔진을 그 자리에서 실행하고(개발 모드), 없으면 엔진을 `~/.cache/motion-studio/engine`으로 복사해서 실행합니다.

```bash
cd plugins/motion-studio/engine && npm install && npx tsc --noEmit
claude plugin validate .
```

스킬을 수정한 뒤에는 세션에서 `/reload-plugins`를 실행하세요.

README 이미지는 `docs/images/`에 있습니다. `slides/`에는 예제 덱의 정지 화면(`motionstudio stills examples/<name> --scale 0.5`)이 들어 있습니다. `diagrams/`에는 `examples/minimal/assets/*.svg`의 테마 토큰을 `minimal`과 `minimal-dark` 색으로 바꾼 사본이 들어 있습니다. GitHub는 SVG를 테마 변수 없이 일반 이미지로 보여 주기 때문입니다. 예제가 바뀌면 이 이미지들도 다시 만들어 주세요.

## 라이선스 참고

Remotion은 개인과 직원 3명 이하의 회사에는 무료이며, 그보다 큰 회사는 [회사 라이선스](https://remotion.dev/license)가 필요합니다. 상업적으로 사용하기 전에 Hugging Face에서 Supertonic 모델 라이선스를 확인하세요.
