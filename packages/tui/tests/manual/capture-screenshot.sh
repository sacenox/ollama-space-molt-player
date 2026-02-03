#!/usr/bin/env bash
#
# Capture screenshot of a manual test
# Usage: ./capture-screenshot.sh <test-file> <output-name>
#
# Example: ./capture-screenshot.sh layout-preview.tsx layout-preview
#

set -e

TEST_FILE=$1
OUTPUT_NAME=$2

if [ -z "$TEST_FILE" ] || [ -z "$OUTPUT_NAME" ]; then
	echo "Usage: $0 <test-file> <output-name>"
	echo "Example: $0 layout-preview.tsx layout-preview"
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/screenshots"

mkdir -p "$OUTPUT_DIR"

echo "Capturing screenshot of $TEST_FILE..."
echo "Output will be saved to: $OUTPUT_DIR/$OUTPUT_NAME.txt"

# Run test and capture output to file
timeout 2 bun "$SCRIPT_DIR/$TEST_FILE" > "$OUTPUT_DIR/$OUTPUT_NAME.txt" 2>&1 || true

echo "Screenshot captured successfully!"
echo "View with: cat $OUTPUT_DIR/$OUTPUT_NAME.txt"
