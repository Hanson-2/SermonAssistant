import os

# File extensions to capture
relevant_extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md']

# Folders to skip
excluded_folders = ['node_modules', '.git', '.firebase', 'dist', 'build', 'coverage', '.next']

# Output file in the script's directory
script_directory = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(script_directory, 'exported_files.txt')

def collect_files_recursively(directory, base_dir=""):
    results = []

    for entry in os.listdir(directory):
        full_path = os.path.join(directory, entry)
        relative_path = os.path.join(base_dir, entry)

        if os.path.isdir(full_path):
            if entry in excluded_folders:
                continue  # Skip excluded directories
            results.extend(collect_files_recursively(full_path, relative_path))
        elif os.path.isfile(full_path) and os.path.splitext(entry)[1] in relevant_extensions:
            try:
                with open(full_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    line_count = content.count('\n') + 1
                    file_size_kb = os.path.getsize(full_path) / 1024
                    summary = (
                        f"File: {relative_path}\n"
                        f"Lines: {line_count}\n"
                        f"Size: {file_size_kb:.2f} KB\n\n"
                        f"{content}\n"
                        + "-"*80 + "\n"
                    )
                    results.append(summary)
            except Exception as e:
                print(f"Could not read file {relative_path}: {e}")

    return results

# Collect all relevant files
collected_files = collect_files_recursively(os.getcwd())

# Write results to the output file
with open(output_file, 'w', encoding='utf-8') as txt_file:
    txt_file.writelines(collected_files)

# Final confirmation
print(f"\n✅ Export Complete.\nExported {len(collected_files)} files to:\n{output_file}\n")
