# MML Runner

This extension adds basic support for `.muc` MML files and binds `F5` to reproduce music with `mucom88`.

## Features

- Registers `.muc` as language `MML`.
- Minimal syntax highlighting: lines starting with `#` are comments.
- In an active MML editor, `F5` toggles reproduction:
  - saves the current file
  - runs `mucom88 {filepath}`
  - pressing `F5` again stops the process
- While running, the status bar shows `Reproducing MML...` in green.
- If process exits with non-zero code, stdout/stderr are shown with `showErrorMessage`.

## Requirement

- `mucom88` must be available on PATH.
