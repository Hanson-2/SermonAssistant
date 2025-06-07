import os
import zipfile

# Configurable: your project root and output zip filename
PROJECT_ROOT = os.path.abspath('.')  # Change if needed
OUTPUT_ZIP = 'frontend_export.zip'

# File extensions to include
INCLUDE_EXTENSIONS = ('.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.sass')

# Directory substrings to exclude
EXCLUDE_DIRS = [
    'node_modules', 'dist', 'build', '.next', 'functions', 'public', '.git', 'venv',
    'android', 'ios', '__pycache__'
]

def should_include_file(filepath):
    # Only include allowed extensions
    if not filepath.endswith(INCLUDE_EXTENSIONS):
        return False
    # Exclude if in an excluded directory
    for ex in EXCLUDE_DIRS:
        if f'{os.sep}{ex}{os.sep}' in filepath or filepath.startswith(ex + os.sep):
            return False
    return True

def export_frontend_files(project_root, output_zip):
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for folder, _, files in os.walk(project_root):
            # Skip excluded directories completely
            if any(ex in folder.split(os.sep) for ex in EXCLUDE_DIRS):
                continue
            for file in files:
                rel_path = os.path.relpath(os.path.join(folder, file), project_root)
                abs_path = os.path.join(folder, file)
                if should_include_file(rel_path):
                    print(f'Adding: {rel_path}')
                    zipf.write(abs_path, rel_path)
    print(f'\nExport complete: {output_zip}')

if __name__ == '__main__':
    export_frontend_files(PROJECT_ROOT, OUTPUT_ZIP)
