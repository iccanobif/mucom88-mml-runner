# MML Runner

This extension adds basic support for `.muc` MML files and binds `F5` to reproduce music with `mucom88`.

## Features

- Registers `.muc` as language `MML`.
- Minimal syntax highlighting: lines starting with `#` are comments.
- In an active MML editor, `F5` reproduces or restarts reproduction:
  - saves the current file
  - runs `mucom88 {filepath}`
-  - pressing `F5` again re-saves, stops the current process, and starts a new one
- In an active MML editor, `Shift+F5` stops reproduction without starting a new process
- While running, the status bar shows `Reproducing MML...` in green.
- If process exits with non-zero code, stdout/stderr are shown with `showErrorMessage`.

## Requirement

- `mucom88` must be available on PATH.
