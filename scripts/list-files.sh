#!/bin/bash

# Script name: gather_ts_files.sh
# Description: Gather all .ts, .tsx, and .json files recursively
# Created by: ConnectPlatform
# Date: 2024-12-25 22:51:28 UTC

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output filename with timestamp
OUTPUT_FILE="typescript_files_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${BLUE}Starting file gathering process...${NC}"
echo "Collecting .ts, .tsx, and .json files..."
echo "Excluding: node_modules and .next directories"
echo "Output will be saved to: $OUTPUT_FILE"

# Find files and save them to output file
find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
    -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    2>/dev/null | \
    sort > "$OUTPUT_FILE"

# Count files by type
TS_COUNT=$(grep "\.ts$" "$OUTPUT_FILE" | wc -l)
TSX_COUNT=$(grep "\.tsx$" "$OUTPUT_FILE" | wc -l)
JSON_COUNT=$(grep "\.json$" "$OUTPUT_FILE" | wc -l)
TOTAL_FILES=$((TS_COUNT + TSX_COUNT + JSON_COUNT))

# Print summary
echo -e "\n${GREEN}Process completed!${NC}"
echo -e "Summary:"
echo "----------------------------------------"
echo "TypeScript (.ts) files:  $TS_COUNT"
echo "React TSX (.tsx) files:  $TSX_COUNT"
echo "JSON files:              $JSON_COUNT"
echo "----------------------------------------"
echo -e "Total files found:        ${GREEN}$TOTAL_FILES${NC}"
echo "Results saved to:        $OUTPUT_FILE"

# Display preview of found files
echo -e "\nPreview of found files:"
echo "----------------------------------------"
head -n 5 "$OUTPUT_FILE"
echo "----------------------------------------"

# Optional: Create separate files by extension
if [ "$TOTAL_FILES" -gt 0 ]; then
    echo -e "\nWould you like to create separate files for each extension? (y/n)"
    read -r RESPONSE
    if [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
        grep "\.ts$" "$OUTPUT_FILE" > "typescript_files.txt"
        grep "\.tsx$" "$OUTPUT_FILE" > "react_files.txt"
        grep "\.json$" "$OUTPUT_FILE" > "json_files.txt"
        echo "Separate files created:"
        echo "- typescript_files.txt"
        echo "- react_files.txt"
        echo "- json_files.txt"
    fi
fi

echo -e "\n${GREEN}Script execution completed!${NC}"