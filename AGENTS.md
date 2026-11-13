# Repository Guidelines

## 에이전트 작업 및 승인 규칙

### 수정 전 계획 보고

모든 에이전트는 사용자의 요청을 받으면 바로 수정하지 않는다. 수정 전에 반드시 다음 내용을 먼저 보고한다.

- 요청 이해
- 수정 목적
- 수정 대상 파일
- 각 파일에서 바꿀 내용
- 예상되는 결과
- 기존 기능에 미칠 영향
- 가능한 대안이 있다면 대안

### 명시적 승인 및 범위 준수

사용자가 "진행해", "수정해", "승인", "그대로 해" 등 명확하게 허락하기 전까지 파일을 생성, 수정, 삭제하지 않는다. 사용자가 일부만 승인하면 승인된 범위만 수정한다.

### 추가 제안 및 담당 영역 변경

에이전트가 더 좋은 아이디어를 가지고 있어도 임의로 적용하지 않고 먼저 제안한다. 다른 담당 영역의 파일을 수정해야 한다면 그 이유를 먼저 보고하고 승인받는다.

### 수정 완료 보고

수정 완료 후에는 다음 내용을 보고한다. 추가된 기능이나 제거된 내용이 없으면 "없음"으로 명시한다.

- 수정한 파일
- 실제 변경 내용
- 추가된 기능
- 제거된 내용
- 확인해야 할 부분

## Project Structure & Module Organization

This is a buildless, Korean-language demo website for the fictional SEOUL BLACK FC football club. All source files live in the repository root:

- `index.html`: semantic page structure, navigation, hero, three news cards, players, fixtures, and news dialog.
- `style.css`: monochrome design, typography, layouts, and responsive breakpoints.
- `script.js`: mobile navigation, fixture filters, news dialog content, and footer year.

There are no test or local asset directories. Images load from Unsplash; fonts load from Google Fonts. These resources require internet access.

## Build, Test, and Development Commands

- Open `index.html` directly in a browser for a quick preview.
- `python -m http.server 8000`: serve the repository locally; visit `http://localhost:8000`. Stop with `Ctrl+C`. Python must be installed.
- `node --check script.js`: check JavaScript syntax when Node.js is available. This does not exercise browser behavior.

No package manager, dependency installation, or build step is configured.

## Coding Style & Naming Conventions

Use UTF-8 to preserve Korean text. Use two-space indentation for JavaScript and newly expanded HTML/CSS blocks. Existing HTML and CSS contain compact sections; avoid unrelated formatting changes.

Use `const` by default, camelCase JavaScript identifiers, single-quoted strings, and semicolons. Use descriptive kebab-case CSS classes and IDs, such as `.fixture-opponent`. Keep `data-filter`, `data-venue`, and `data-news` attributes consistent with JavaScript selectors. No formatter or linter is configured.

## Testing Guidelines

No automated test framework or coverage threshold exists. After changes, run the syntax check and manually verify:

- Mobile menu toggling, Escape behavior, and navigation links.
- All/home/away fixture filters and news dialog opening and closing.
- Keyboard focus, accessible button labels, and narrow-screen layouts around the 700px breakpoint.

Check both mobile and desktop widths for overflow and readable text.

## Commit & Pull Request Guidelines

No `.git` directory is present, so commit conventions cannot be inferred. Use concise imperative subjects, for example `Fix mobile fixture layout`.

Describe the change, its purpose, and validation performed in each pull request. Link related issues when available and include desktop/mobile screenshots for visual changes.

## Content & Accessibility

Keep fictional teams, players, news, and schedules clearly identified as demo content. Preserve semantic headings, image alternatives, reduced-motion support, and ARIA state updates when changing interactions.
