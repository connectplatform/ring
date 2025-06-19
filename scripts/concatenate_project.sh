#!/bin/bash

# Define the project name
projectName="Ring"

# Define the output file name
outputFile="${projectName}_full_source_code.txt"

# Remove the output file if it already exists
rm -f "$outputFile"

# Function to process files
process_files() {
    for file in "$1"/*; do
        if [ -d "$file" ]; then
            if [[ "$file" != *"/node_modules"* ]] && [[ "$file" != *"/.next"* ]]; then
                process_files "$file"
            fi
        elif [ -f "$file" ]; then
            # Skip package-lock.json
            if [[ "$(basename "$file")" == "package-lock.json" ]]; then
                continue
            fi
            
            case "$file" in
                *.ts|*.tsx|*.js|*.mjs|*.json|*.md|*.css)
                    echo "File: $file" >> "$outputFile"
                    echo "----------------------------------------" >> "$outputFile"
                    cat "$file" >> "$outputFile"
                    echo -e "\n\n" >> "$outputFile"
                    ;;
            esac
        fi
    done
}

# Start processing from the current directory
process_files "."

echo "Concatenation complete. Output file: $outputFile"