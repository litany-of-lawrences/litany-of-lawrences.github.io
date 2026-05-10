# Litany Desktop Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform (Mac/Windows/Linux) desktop app using Tauri 2 that lets a user clone/pull the litany-of-lawrences repo, edit article markdown files with a live preview, and push changes to the `gh-pages` branch for publishing.

**Architecture:** Tauri 2 app with a vanilla TypeScript + Vite frontend and Rust backend. The Rust side handles all git operations (clone, pull, status, commit, push) and file I/O via custom Tauri commands. The frontend is a two-pane editor: file list on the left, markdown editor + live preview on the right. The app stores the repo path in local config so it persists between sessions.

**Tech Stack:** Tauri 2, Rust (std::process::Command for git), TypeScript, Vite, a lightweight markdown-to-HTML library (marked), CSS.

---

## File Structure

```
litany/
├── package.json                    # Vite + Tauri CLI + frontend deps
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite config (minimal)
├── index.html                      # App shell
├── src/
│   ├── main.ts                     # Entry point — init app, wire up events
│   ├── git.ts                      # Frontend wrappers around git Tauri commands
│   ├── files.ts                    # Frontend wrappers around file I/O commands
│   ├── editor.ts                   # Editor pane logic (textarea + preview)
│   ├── filelist.ts                 # File list sidebar logic
│   ├── toolbar.ts                  # Top toolbar (pull, commit, push, status)
│   └── styles.css                  # All app styles
├── src-tauri/
│   ├── Cargo.toml                  # Rust deps: tauri, serde, serde_json
│   ├── build.rs                    # Tauri build script
│   ├── tauri.conf.json             # Tauri config (window, build paths)
│   ├── capabilities/
│   │   └── default.json            # Permissions for fs, shell
│   └── src/
│       ├── main.rs                 # Windows subsystem attr + call lib::run()
│       ├── lib.rs                  # Tauri builder — registers commands
│       ├── git.rs                  # Git commands: clone, pull, status, commit, push
│       └── files.rs                # File commands: list_articles, read_file, write_file
```

---

## Task 1: Scaffold Tauri 2 Project

**Files:**
- Create: `litany/package.json`
- Create: `litany/src-tauri/Cargo.toml`
- Create: `litany/src-tauri/tauri.conf.json`
- Create: `litany/src-tauri/build.rs`
- Create: `litany/src-tauri/capabilities/default.json`
- Create: `litany/src-tauri/src/main.rs`
- Create: `litany/src-tauri/src/lib.rs`
- Create: `litany/index.html`
- Create: `litany/src/main.ts`
- Create: `litany/src/styles.css`
- Create: `litany/tsconfig.json`
- Create: `litany/vite.config.ts`

- [ ] **Step 1: Create the project directory and initialize npm**

```bash
mkdir -p litany
cd litany
```

Create `package.json`:
```json
{
  "name": "litany-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "marked": "^15"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "typescript": "^5.6",
    "vite": "^6"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

- [ ] **Step 4: Create index.html (app shell)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Litany of Lawrences — Editor</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
  <div id="app">
    <div id="toolbar"></div>
    <div id="workspace">
      <div id="file-list"></div>
      <div id="editor-pane">
        <textarea id="editor" placeholder="Select a file to edit…"></textarea>
        <div id="preview"></div>
      </div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/styles.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --parchment: #f5f0e8;
  --brown: #2c1810;
  --brown-light: #5a3e28;
  --gold: #c8a96e;
  --link: #8b6340;
  --border: #c8b89a;
  --sidebar-bg: #ede8dc;
  --font: Baskerville, 'Libre Baskerville', Georgia, serif;
}

body {
  font-family: var(--font);
  background: var(--parchment);
  color: var(--brown);
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Toolbar */
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--brown);
  color: #f0e6d3;
  font-size: 14px;
}

#toolbar button {
  font-family: var(--font);
  font-size: 13px;
  padding: 4px 12px;
  border: 1px solid var(--brown-light);
  background: var(--brown-light);
  color: #f0e6d3;
  cursor: pointer;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

#toolbar button:hover { background: var(--link); }
#toolbar button:disabled { opacity: 0.4; cursor: default; }

#toolbar .status {
  margin-left: auto;
  font-size: 12px;
  font-style: italic;
  color: var(--gold);
}

/* Workspace */
#workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* File list sidebar */
#file-list {
  width: 280px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px 0;
}

.file-item {
  display: block;
  padding: 6px 14px;
  font-size: 14px;
  color: var(--brown);
  cursor: pointer;
  text-decoration: none;
  border-left: 3px solid transparent;
}

.file-item:hover { background: rgba(200, 169, 110, 0.15); }
.file-item.active {
  background: #fff;
  border-left-color: var(--gold);
  font-weight: bold;
}

.file-item-title { display: block; }
.file-item-dates {
  font-size: 12px;
  color: #888;
  font-style: italic;
}

/* Editor pane */
#editor-pane {
  flex: 1;
  display: flex;
  overflow: hidden;
}

#editor {
  flex: 1;
  padding: 16px;
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.6;
  border: none;
  border-right: 1px solid var(--border);
  background: #fff;
  color: var(--brown);
  resize: none;
  outline: none;
  tab-size: 2;
}

#preview {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.7;
  color: #333;
}

#preview h1 { font-size: 22px; margin-bottom: 8px; color: var(--brown); }
#preview p { margin-bottom: 1em; }
#preview strong { color: var(--brown); }
#preview a { color: var(--link); }
#preview hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

/* Setup screen */
.setup-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  padding: 48px;
  text-align: center;
}

.setup-screen h2 { font-size: 20px; margin-bottom: 8px; }
.setup-screen p { color: #888; font-style: italic; font-size: 14px; max-width: 400px; }

.setup-screen input {
  font-family: var(--font);
  font-size: 15px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: #fff;
  width: 400px;
  color: var(--brown);
  outline: none;
}

.setup-screen input:focus { border-color: var(--gold); }

.setup-screen button {
  font-family: var(--font);
  font-size: 14px;
  padding: 8px 24px;
  background: var(--brown);
  color: #f0e6d3;
  border: none;
  cursor: pointer;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.setup-screen button:hover { background: var(--link); }
```

- [ ] **Step 6: Create src/main.ts (placeholder entry point)**

```ts
console.log("Litany Desktop starting…");
```

- [ ] **Step 7: Create Rust scaffolding**

`src-tauri/Cargo.toml`:
```toml
[package]
name = "litany-desktop"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

`src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build();
}
```

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    litany_desktop_lib::run();
}
```

`src-tauri/src/lib.rs`:
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Litany of Lawrences",
  "version": "0.1.0",
  "identifier": "com.litanyoflawrences.editor",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Litany of Lawrences — Editor",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 500
      }
    ]
  },
  "plugins": {}
}
```

`src-tauri/capabilities/default.json`:
```json
{
  "identifier": "default",
  "description": "Default app capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 8: Install dependencies and verify the app launches**

```bash
cd litany
npm install
npx tauri dev
```

Expected: A window opens showing "Litany Desktop starting…" in the dev console, with the toolbar, sidebar, and editor pane visible (empty).

- [ ] **Step 9: Commit**

```bash
git add litany/
git commit -m "feat: scaffold Tauri 2 desktop app with vanilla TS + Vite"
```

---

## Task 2: Rust Git Commands

**Files:**
- Create: `litany/src-tauri/src/git.rs`
- Modify: `litany/src-tauri/src/lib.rs`

- [ ] **Step 1: Create git.rs with all git commands**

`src-tauri/src/git.rs`:
```rust
use std::process::Command;

fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map(|s| s.trim().to_string())
            .map_err(|e| e.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("git {} failed with exit code {:?}", args[0], output.status.code())
        } else {
            stderr
        })
    }
}

#[tauri::command]
pub fn git_clone(url: String, dest: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["clone", &url, &dest])
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if output.status.success() {
        Ok(format!("Cloned to {}", dest))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn git_pull(repo_path: String) -> Result<String, String> {
    run_git(&repo_path, &["pull"])
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<String, String> {
    run_git(&repo_path, &["status", "--porcelain"])
}

#[tauri::command]
pub fn git_add(repo_path: String, file_path: String) -> Result<String, String> {
    run_git(&repo_path, &["add", &file_path])
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    run_git(&repo_path, &["commit", "-m", &message])
}

#[tauri::command]
pub fn git_push(repo_path: String) -> Result<String, String> {
    run_git(&repo_path, &["push"])
}

#[tauri::command]
pub fn git_current_branch(repo_path: String) -> Result<String, String> {
    run_git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
}

#[tauri::command]
pub fn git_checkout(repo_path: String, branch: String) -> Result<String, String> {
    run_git(&repo_path, &["checkout", &branch])
}
```

- [ ] **Step 2: Register git commands in lib.rs**

Replace `src-tauri/src/lib.rs`:
```rust
mod git;
mod files;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            git::git_clone,
            git::git_pull,
            git::git_status,
            git::git_add,
            git::git_commit,
            git::git_push,
            git::git_current_branch,
            git::git_checkout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Note: `mod files;` will produce a compile warning until Task 3 — that's fine, or add it in Task 3 instead.

- [ ] **Step 3: Verify it compiles**

```bash
cd litany && npx tauri build --debug 2>&1 | tail -5
```

Expected: Compiles without errors (warnings about unused `files` module are fine).

- [ ] **Step 4: Commit**

```bash
git add litany/src-tauri/src/git.rs litany/src-tauri/src/lib.rs
git commit -m "feat: add Rust git commands (clone, pull, status, commit, push)"
```

---

## Task 3: Rust File I/O Commands

**Files:**
- Create: `litany/src-tauri/src/files.rs`
- Modify: `litany/src-tauri/src/lib.rs`

- [ ] **Step 1: Create files.rs**

`src-tauri/src/files.rs`:
```rust
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct ArticleEntry {
    pub filename: String,
    pub title: String,
    pub slug: String,
}

fn extract_title(content: &str) -> Option<String> {
    for line in content.lines() {
        if let Some(title) = line.strip_prefix("# ") {
            let title = title.trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
    }
    None
}

#[tauri::command]
pub fn list_articles(repo_path: String) -> Result<Vec<ArticleEntry>, String> {
    let articles_dir = Path::new(&repo_path).join("articles");
    if !articles_dir.exists() {
        return Err(format!("articles/ directory not found in {}", repo_path));
    }

    let mut entries: Vec<ArticleEntry> = Vec::new();

    let read_dir = fs::read_dir(&articles_dir).map_err(|e| e.to_string())?;
    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = entry.file_name().to_string_lossy().to_string();
        let slug = filename.trim_end_matches(".md").to_string();
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let title = extract_title(&content).unwrap_or_else(|| slug.clone());
        entries.push(ArticleEntry { filename, title, slug });
    }

    entries.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(entries)
}

#[tauri::command]
pub fn read_article(repo_path: String, filename: String) -> Result<String, String> {
    let path = Path::new(&repo_path).join("articles").join(&filename);
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[tauri::command]
pub fn write_article(repo_path: String, filename: String, content: String) -> Result<(), String> {
    let path = Path::new(&repo_path).join("articles").join(&filename);
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", filename, e))
}
```

- [ ] **Step 2: Register file commands in lib.rs**

Update `lib.rs` invoke_handler to add the file commands:
```rust
mod git;
mod files;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            git::git_clone,
            git::git_pull,
            git::git_status,
            git::git_add,
            git::git_commit,
            git::git_push,
            git::git_current_branch,
            git::git_checkout,
            files::list_articles,
            files::read_article,
            files::write_article,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd litany && npx tauri build --debug 2>&1 | tail -5
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add litany/src-tauri/src/files.rs litany/src-tauri/src/lib.rs
git commit -m "feat: add Rust file I/O commands (list, read, write articles)"
```

---

## Task 4: Frontend Git Wrappers

**Files:**
- Create: `litany/src/git.ts`
- Create: `litany/src/files.ts`

- [ ] **Step 1: Create src/git.ts**

```ts
import { invoke } from "@tauri-apps/api/core";

export function gitClone(url: string, dest: string): Promise<string> {
  return invoke("git_clone", { url, dest });
}

export function gitPull(repoPath: string): Promise<string> {
  return invoke("git_pull", { repoPath });
}

export function gitStatus(repoPath: string): Promise<string> {
  return invoke("git_status", { repoPath });
}

export function gitAdd(repoPath: string, filePath: string): Promise<string> {
  return invoke("git_add", { repoPath, filePath });
}

export function gitCommit(repoPath: string, message: string): Promise<string> {
  return invoke("git_commit", { repoPath, message });
}

export function gitPush(repoPath: string): Promise<string> {
  return invoke("git_push", { repoPath });
}

export function gitCurrentBranch(repoPath: string): Promise<string> {
  return invoke("git_current_branch", { repoPath });
}

export function gitCheckout(repoPath: string, branch: string): Promise<string> {
  return invoke("git_checkout", { repoPath, branch });
}
```

- [ ] **Step 2: Create src/files.ts**

```ts
import { invoke } from "@tauri-apps/api/core";

export interface ArticleEntry {
  filename: string;
  title: string;
  slug: string;
}

export function listArticles(repoPath: string): Promise<ArticleEntry[]> {
  return invoke("list_articles", { repoPath });
}

export function readArticle(repoPath: string, filename: string): Promise<string> {
  return invoke("read_article", { repoPath, filename });
}

export function writeArticle(repoPath: string, filename: string, content: string): Promise<void> {
  return invoke("write_article", { repoPath, filename, content });
}
```

- [ ] **Step 3: Commit**

```bash
git add litany/src/git.ts litany/src/files.ts
git commit -m "feat: add TypeScript wrappers for git and file Tauri commands"
```

---

## Task 5: Setup Screen (Repo Path Configuration)

**Files:**
- Create: `litany/src/setup.ts`
- Modify: `litany/src/main.ts`

The setup screen appears when the app has no configured repo path. The user enters a local path to their clone of the repo.

- [ ] **Step 1: Create src/setup.ts**

```ts
const STORAGE_KEY = "litany_repo_path";

export function getRepoPath(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setRepoPath(path: string): void {
  localStorage.setItem(STORAGE_KEY, path);
}

export function clearRepoPath(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function renderSetupScreen(
  container: HTMLElement,
  onReady: (repoPath: string) => void
): void {
  container.innerHTML = `
    <div class="setup-screen">
      <h2>Litany of Lawrences — Editor</h2>
      <p>Enter the path to your local clone of the litany-of-lawrences repository.</p>
      <input id="setup-path" type="text" placeholder="/Users/you/litany-of-lawrences" />
      <button id="setup-confirm">Open Repository</button>
      <p id="setup-error" style="color: #c44; display: none;"></p>
    </div>
  `;

  const input = container.querySelector("#setup-path") as HTMLInputElement;
  const btn = container.querySelector("#setup-confirm") as HTMLButtonElement;
  const error = container.querySelector("#setup-error") as HTMLElement;

  // Pre-fill if we have a saved path
  const saved = getRepoPath();
  if (saved) input.value = saved;

  btn.addEventListener("click", async () => {
    const path = input.value.trim();
    if (!path) {
      error.textContent = "Please enter a path.";
      error.style.display = "";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Checking…";
    error.style.display = "none";

    try {
      // Verify it's a valid repo by checking for articles/
      const { listArticles } = await import("./files");
      const articles = await listArticles(path);
      if (articles.length === 0) {
        throw new Error("No articles found — is this the right repo?");
      }
      setRepoPath(path);
      onReady(path);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      error.textContent = msg;
      error.style.display = "";
      btn.disabled = false;
      btn.textContent = "Open Repository";
    }
  });
}
```

- [ ] **Step 2: Wire up main.ts with setup flow**

Replace `src/main.ts`:
```ts
import { getRepoPath, renderSetupScreen } from "./setup";

const app = document.getElementById("app")!;

function startApp(repoPath: string) {
  // Placeholder — Tasks 6-8 will fill this in
  app.innerHTML = `
    <div id="toolbar"></div>
    <div id="workspace">
      <div id="file-list"></div>
      <div id="editor-pane">
        <textarea id="editor" placeholder="Select a file to edit…"></textarea>
        <div id="preview"></div>
      </div>
    </div>
  `;
  console.log("App started with repo:", repoPath);
}

const saved = getRepoPath();
if (saved) {
  startApp(saved);
} else {
  renderSetupScreen(app, startApp);
}
```

- [ ] **Step 3: Verify the setup screen renders**

```bash
cd litany && npx tauri dev
```

Expected: App opens showing the setup screen with path input and "Open Repository" button. Entering a valid repo path navigates to the empty workspace.

- [ ] **Step 4: Commit**

```bash
git add litany/src/setup.ts litany/src/main.ts
git commit -m "feat: add setup screen for repo path configuration"
```

---

## Task 6: File List Sidebar

**Files:**
- Create: `litany/src/filelist.ts`
- Modify: `litany/src/main.ts`

- [ ] **Step 1: Create src/filelist.ts**

```ts
import { listArticles, ArticleEntry } from "./files";

export async function renderFileList(
  container: HTMLElement,
  repoPath: string,
  onSelect: (entry: ArticleEntry) => void
): Promise<void> {
  container.innerHTML = '<div class="file-item" style="color:#888;font-style:italic">Loading…</div>';

  try {
    const articles = await listArticles(repoPath);
    container.innerHTML = "";

    for (const article of articles) {
      const div = document.createElement("div");
      div.className = "file-item";
      div.dataset.filename = article.filename;

      const titleSpan = document.createElement("span");
      titleSpan.className = "file-item-title";
      titleSpan.textContent = article.title;
      div.appendChild(titleSpan);

      div.addEventListener("click", () => {
        container.querySelectorAll(".file-item").forEach((el) =>
          el.classList.remove("active")
        );
        div.classList.add("active");
        onSelect(article);
      });

      container.appendChild(div);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    container.innerHTML = `<div class="file-item" style="color:#c44">${msg}</div>`;
  }
}
```

- [ ] **Step 2: Integrate file list into main.ts**

Replace `src/main.ts`:
```ts
import { getRepoPath, renderSetupScreen } from "./setup";
import { renderFileList } from "./filelist";
import { readArticle } from "./files";

const app = document.getElementById("app")!;

async function startApp(repoPath: string) {
  app.innerHTML = `
    <div id="toolbar"></div>
    <div id="workspace">
      <div id="file-list"></div>
      <div id="editor-pane">
        <textarea id="editor" placeholder="Select a file to edit…"></textarea>
        <div id="preview"></div>
      </div>
    </div>
  `;

  const fileListEl = document.getElementById("file-list")!;
  const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
  const previewEl = document.getElementById("preview")!;

  await renderFileList(fileListEl, repoPath, async (article) => {
    try {
      const content = await readArticle(repoPath, article.filename);
      editorEl.value = content;
      // Preview will be wired in Task 7
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      editorEl.value = `Error loading file: ${msg}`;
    }
  });
}

const saved = getRepoPath();
if (saved) {
  startApp(saved);
} else {
  renderSetupScreen(app, startApp);
}
```

- [ ] **Step 3: Verify file list loads and selecting a file populates the editor**

```bash
cd litany && npx tauri dev
```

Expected: Sidebar shows sorted article titles. Clicking one loads its markdown content into the textarea.

- [ ] **Step 4: Commit**

```bash
git add litany/src/filelist.ts litany/src/main.ts
git commit -m "feat: add file list sidebar with article loading"
```

---

## Task 7: Markdown Editor with Live Preview

**Files:**
- Create: `litany/src/editor.ts`
- Modify: `litany/src/main.ts`

- [ ] **Step 1: Create src/editor.ts**

```ts
import { marked } from "marked";
import { writeArticle } from "./files";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let currentFilename: string | null = null;
let currentRepoPath: string | null = null;
let dirty = false;

export function initEditor(
  editorEl: HTMLTextAreaElement,
  previewEl: HTMLElement,
  onDirtyChange: (isDirty: boolean) => void
): void {
  editorEl.addEventListener("input", () => {
    updatePreview(editorEl, previewEl);
    dirty = true;
    onDirtyChange(true);

    // Auto-save after 1 second of inactivity
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => save(editorEl, onDirtyChange), 1000);
  });
}

export function loadFile(
  editorEl: HTMLTextAreaElement,
  previewEl: HTMLElement,
  repoPath: string,
  filename: string,
  content: string,
  onDirtyChange: (isDirty: boolean) => void
): void {
  // Save previous file if dirty
  if (dirty && currentFilename) {
    save(editorEl, onDirtyChange);
  }

  currentRepoPath = repoPath;
  currentFilename = filename;
  editorEl.value = content;
  dirty = false;
  onDirtyChange(false);
  updatePreview(editorEl, previewEl);
}

function updatePreview(editorEl: HTMLTextAreaElement, previewEl: HTMLElement): void {
  previewEl.innerHTML = marked.parse(editorEl.value) as string;
}

async function save(
  editorEl: HTMLTextAreaElement,
  onDirtyChange: (isDirty: boolean) => void
): Promise<void> {
  if (!currentRepoPath || !currentFilename || !dirty) return;

  try {
    await writeArticle(currentRepoPath, currentFilename, editorEl.value);
    dirty = false;
    onDirtyChange(false);
  } catch (e: unknown) {
    console.error("Auto-save failed:", e);
  }
}

export function getCurrentFilename(): string | null {
  return currentFilename;
}

export function isDirty(): boolean {
  return dirty;
}
```

- [ ] **Step 2: Wire editor into main.ts**

Replace `src/main.ts`:
```ts
import { getRepoPath, renderSetupScreen } from "./setup";
import { renderFileList } from "./filelist";
import { readArticle } from "./files";
import { initEditor, loadFile } from "./editor";

const app = document.getElementById("app")!;

async function startApp(repoPath: string) {
  app.innerHTML = `
    <div id="toolbar">
      <span class="status" id="toolbar-status"></span>
    </div>
    <div id="workspace">
      <div id="file-list"></div>
      <div id="editor-pane">
        <textarea id="editor" placeholder="Select a file to edit…"></textarea>
        <div id="preview"></div>
      </div>
    </div>
  `;

  const fileListEl = document.getElementById("file-list")!;
  const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
  const previewEl = document.getElementById("preview")!;
  const statusEl = document.getElementById("toolbar-status")!;

  initEditor(editorEl, previewEl, (isDirty) => {
    statusEl.textContent = isDirty ? "Unsaved changes" : "";
  });

  await renderFileList(fileListEl, repoPath, async (article) => {
    try {
      const content = await readArticle(repoPath, article.filename);
      loadFile(editorEl, previewEl, repoPath, article.filename, content, (isDirty) => {
        statusEl.textContent = isDirty ? "Unsaved changes" : "";
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      editorEl.value = `Error loading file: ${msg}`;
    }
  });
}

const saved = getRepoPath();
if (saved) {
  startApp(saved);
} else {
  renderSetupScreen(app, startApp);
}
```

- [ ] **Step 3: Verify editor and preview work**

```bash
cd litany && npx tauri dev
```

Expected: Select a file — markdown appears in textarea, rendered HTML in preview pane. Editing the textarea updates the preview live and auto-saves after 1 second.

- [ ] **Step 4: Commit**

```bash
git add litany/src/editor.ts litany/src/main.ts
git commit -m "feat: add markdown editor with live preview and auto-save"
```

---

## Task 8: Toolbar (Pull, Commit, Push)

**Files:**
- Create: `litany/src/toolbar.ts`
- Modify: `litany/src/main.ts`

- [ ] **Step 1: Create src/toolbar.ts**

```ts
import { gitPull, gitStatus, gitAdd, gitCommit, gitPush, gitCurrentBranch } from "./git";

export async function renderToolbar(
  container: HTMLElement,
  repoPath: string,
  statusEl: HTMLElement,
  onRefresh: () => void
): Promise<void> {
  const pullBtn = document.createElement("button");
  pullBtn.textContent = "Pull";
  pullBtn.id = "btn-pull";

  const commitBtn = document.createElement("button");
  commitBtn.textContent = "Commit";
  commitBtn.id = "btn-commit";

  const pushBtn = document.createElement("button");
  pushBtn.textContent = "Push";
  pushBtn.id = "btn-push";

  const branchLabel = document.createElement("span");
  branchLabel.style.cssText = "font-size:12px; opacity:0.7; margin-left:4px;";

  container.prepend(pushBtn);
  container.prepend(commitBtn);
  container.prepend(pullBtn);
  container.prepend(branchLabel);

  // Show current branch
  try {
    const branch = await gitCurrentBranch(repoPath);
    branchLabel.textContent = `[${branch}]`;
  } catch {
    branchLabel.textContent = "";
  }

  pullBtn.addEventListener("click", async () => {
    pullBtn.disabled = true;
    statusEl.textContent = "Pulling…";
    try {
      const result = await gitPull(repoPath);
      statusEl.textContent = result || "Up to date";
      onRefresh();
    } catch (e: unknown) {
      statusEl.textContent = `Pull failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    pullBtn.disabled = false;
  });

  commitBtn.addEventListener("click", async () => {
    const message = prompt("Commit message:");
    if (!message) return;

    commitBtn.disabled = true;
    statusEl.textContent = "Committing…";
    try {
      // Stage all changed articles
      const status = await gitStatus(repoPath);
      const changedFiles = status
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trim().split(/\s+/).pop()!)
        .filter((f) => f.startsWith("articles/"));

      for (const file of changedFiles) {
        await gitAdd(repoPath, file);
      }

      if (changedFiles.length === 0) {
        statusEl.textContent = "Nothing to commit";
        commitBtn.disabled = false;
        return;
      }

      const result = await gitCommit(repoPath, message);
      statusEl.textContent = result;
    } catch (e: unknown) {
      statusEl.textContent = `Commit failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    commitBtn.disabled = false;
  });

  pushBtn.addEventListener("click", async () => {
    pushBtn.disabled = true;
    statusEl.textContent = "Pushing…";
    try {
      const result = await gitPush(repoPath);
      statusEl.textContent = result || "Pushed";
    } catch (e: unknown) {
      statusEl.textContent = `Push failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    pushBtn.disabled = false;
  });
}
```

- [ ] **Step 2: Wire toolbar into main.ts**

Replace `src/main.ts`:
```ts
import { getRepoPath, renderSetupScreen } from "./setup";
import { renderFileList } from "./filelist";
import { readArticle } from "./files";
import { initEditor, loadFile } from "./editor";
import { renderToolbar } from "./toolbar";

const app = document.getElementById("app")!;

async function startApp(repoPath: string) {
  app.innerHTML = `
    <div id="toolbar">
      <span class="status" id="toolbar-status"></span>
    </div>
    <div id="workspace">
      <div id="file-list"></div>
      <div id="editor-pane">
        <textarea id="editor" placeholder="Select a file to edit…"></textarea>
        <div id="preview"></div>
      </div>
    </div>
  `;

  const toolbarEl = document.getElementById("toolbar")!;
  const fileListEl = document.getElementById("file-list")!;
  const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
  const previewEl = document.getElementById("preview")!;
  const statusEl = document.getElementById("toolbar-status")!;

  const setDirty = (isDirty: boolean) => {
    statusEl.textContent = isDirty ? "Unsaved changes" : "";
  };

  initEditor(editorEl, previewEl, setDirty);

  const refreshFileList = () => {
    renderFileList(fileListEl, repoPath, async (article) => {
      try {
        const content = await readArticle(repoPath, article.filename);
        loadFile(editorEl, previewEl, repoPath, article.filename, content, setDirty);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        editorEl.value = `Error loading file: ${msg}`;
      }
    });
  };

  await renderToolbar(toolbarEl, repoPath, statusEl, refreshFileList);
  refreshFileList();
}

const saved = getRepoPath();
if (saved) {
  startApp(saved);
} else {
  renderSetupScreen(app, startApp);
}
```

- [ ] **Step 3: Verify the full workflow**

```bash
cd litany && npx tauri dev
```

Expected: Toolbar shows branch name and Pull/Commit/Push buttons. Pull fetches latest. Editing a file and clicking Commit prompts for a message and commits the changed articles. Push sends to remote.

- [ ] **Step 4: Commit**

```bash
git add litany/src/toolbar.ts litany/src/main.ts
git commit -m "feat: add toolbar with pull, commit, and push functionality"
```

---

## Task 9: Final Polish and Build Verification

**Files:**
- Modify: `litany/src-tauri/capabilities/default.json` (if needed)
- No new files

- [ ] **Step 1: Verify cross-platform build**

```bash
cd litany && npx tauri build
```

Expected: Produces a distributable app bundle in `src-tauri/target/release/bundle/`.

- [ ] **Step 2: Test the full workflow end-to-end**

1. Launch the app
2. Enter the repo path (e.g., `/Users/admin/development/litany-of-lawrences`)
3. File list loads in sidebar
4. Click an article — markdown appears in editor, rendered preview on right
5. Edit the markdown — preview updates live, auto-saves after 1 second
6. Click Pull — fetches latest changes
7. Click Commit — prompts for message, commits changed article files
8. Click Push — pushes to remote

- [ ] **Step 3: Commit**

```bash
git add -A litany/
git commit -m "feat: complete Litany desktop editor v0.1.0"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-03-litany-desktop-app.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?