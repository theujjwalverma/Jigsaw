# Testing

## Backend

- Unit tests cover scoring, puzzle config generation, and validation logic.
- Integration test covers event creation and player join path.

Run:

- npm run test:backend

## Frontend

- Unit test currently covers time formatter utility.

Run:

- npm run test:frontend

## Coverage Goal

Target is >=80% coverage on changed/new modules. Expand tests for admin flows, websocket ordering, and reconnect behavior before production usage.
