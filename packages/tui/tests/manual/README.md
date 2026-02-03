# Manual TUI Tests

Visual testing suite for TUI components.

## Running Tests

Run a test manually:

```bash
bun tests/manual/layout-preview.tsx
```

The test will display the component. Press Ctrl+C to exit.

## Capturing Screenshots

Capture a screenshot for visual inspection:

```bash
./tests/manual/capture-screenshot.sh layout-preview.tsx layout-preview
```

Screenshots are saved to `tests/manual/screenshots/`.

## Available Tests

- `layout-preview.tsx` - Main layout structure at different terminal sizes
- More tests will be added as components are developed

## Adding New Tests

1. Create a new `.tsx` file in `tests/manual/`
2. Use the `runTests()` function from `test-harness.tsx`
3. Provide test cases with components to render
4. Make the file executable: `chmod +x tests/manual/your-test.tsx`
5. Add shebang: `#!/usr/bin/env bun`
