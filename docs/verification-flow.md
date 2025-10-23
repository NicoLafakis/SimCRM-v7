# Verification Flow Design

This document outlines the new post-signup verification experience. The goal is to require every new player to complete a one-line Tetris challenge before they are considered verified.

## High-Level Flow

1. **Signup Success** – `SignUpPage` receives the created player payload from `/api/dev-auth/signup`.
2. **Transition to Verification Intro** – App stores the pending user and switches to the `verification-intro` view.
3. **Verification Instructions Screen** – Presents the purpose of the challenge, the controls (keyboard + touch), and a “Launch Challenge” button.
4. **Tetris Verification Game** – The player must drop pieces into a 10×20 grid. Completing at least one line marks success. The game now defaults to a classic rule set (no ghost, no next-piece preview, no hard drop) unless enhanced mode is explicitly requested.
5. **Completion** – On success, the game notifies App, which promotes the pending user to the signed-in user and returns to the dashboard state.

## Components & State

- `App.jsx`
  - new state: `pendingUser`, `view` (adds `verification-intro`, `verification-game`).
  - on signup: `setPendingUser(user); setView('verification-intro')`.
  - on verification success: `setUser(pendingUser); setPendingUser(null); setView('dashboard')`.

- `SignUpPage`
  - new prop `onSuccess(user)`.
  - invokes `onSuccess(data.user)` after a successful signup.

- `VerificationIntro.jsx`
  - shows challenge overview, controls reference, and CTA to start.

- `TetrisVerification.jsx`
  - implements Tetris gameplay (classic mode by default) including keyboard handler and touch gamepad overlay.
  - props: `onSuccess()`, `onExit()`, optional `mode` ('classic' | 'enhanced').

- `components/tetris/` helpers
  - `tetrominoes.js` – piece shapes & rotations.
  - `useTetrisEngine.js` – unified rAF loop for gravity + DAS; classic vs enhanced config gates (preview, ghost, hard drop, soft drop behaviors).
  - `GamepadControls.jsx` – touch controls; omits hard drop button in classic mode.

## Verification Success Criteria

- A single cleared line is sufficient.
- On success, the engine calls `onSuccess()` which App uses to mark the user verified.
- If the player exits early, we return them to the intro screen.

## UX Notes

- Keep the pixel aesthetic consistent with existing styles.
- Instruction screen uses the same color palette and fonts.
- Game view (enhanced) includes next-piece preview; classic hides preview & ghost for authenticity.
- Soft drop: classic performs a per-frame descent while ArrowDown held; enhanced uses gravity + optional hard drop only.
- Hard drop: available only in enhanced mode (Space or on-screen control).
- Touch controls: four circular buttons positioned bottom-right/left for directional + rotation actions.

## Future Enhancements (optional)

- Track total lines cleared and store verification timestamp.
- Add sound effects for line clears and piece drops.
- Persist verification state to backend.
