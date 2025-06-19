#!/bin/bash

# Define the project name
projectName="Ring"

# Define the output file name
outputFile="${projectName}_logic_reference.txt"

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
                *.ts|*.tsx|*.js|*.jsx)
                    echo "File: $file" >> "$outputFile"
                    echo "----------------------------------------" >> "$outputFile"
                    
                    # Extract imports
                    grep -n "^import " "$file" >> "$outputFile"
                    
                    # Extract exports
                    grep -n "^export " "$file" >> "$outputFile"
                    
                    # Extract function declarations
                    grep -n "function [a-zA-Z0-9_]\+" "$file" >> "$outputFile"
                    
                    # Extract class declarations
                    grep -n "class [a-zA-Z0-9_]\+" "$file" >> "$outputFile"
                    
                    # Extract React component definitions
                    grep -n "const [a-zA-Z0-9_]\+ = (\|) => {" "$file" >> "$outputFile"
                    
                    # Extract state and effect hooks
                    grep -n "useState\|useEffect\|useCallback\|useMemo" "$file" >> "$outputFile"
                    
                    # Extract route definitions
                    grep -n "app.get\|app.post\|app.put\|app.delete" "$file" >> "$outputFile"
                    
                    # Extract TODO and FIXME comments
                    grep -n "TODO\|FIXME" "$file" >> "$outputFile"
                    
                    echo -e "\n" >> "$outputFile"
                    ;;
                *.prisma)
                    echo "File: $file" >> "$outputFile"
                    echo "----------------------------------------" >> "$outputFile"
                    
                    # Extract Prisma schema definitions
                    grep -n "model [a-zA-Z0-9_]\+" "$file" >> "$outputFile"
                    
                    echo -e "\n" >> "$outputFile"
                    ;;
            esac
        fi
    done
}

# Start processing from the current directory
process_files "."

echo "Logic extraction complete. Output file: $outputFile"