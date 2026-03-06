import os
import re

backend_dir = r"c:\Users\Dell\Desktop\AI Agent Healthcare\backend"

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                new_content = re.sub(r'from backend\.', 'from ', content)
                new_content = re.sub(r'import backend\.', 'import ', new_content)
                
                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"Fixed {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
