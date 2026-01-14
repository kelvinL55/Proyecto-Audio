import subprocess
import webbrowser
import time
import os
import sys

def run_app():
    # Get the directory where the script is located
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)

    print(f"Starting application in: {project_dir}")
    
    # Run npm run dev
    # We use shell=True because 'npm' is a .cmd/.ps1 on Windows
    try:
        # Start the process
        process = subprocess.Popen(["npm", "run", "dev"], shell=True)
        
        print("Waiting for server to start...")
        time.sleep(3) # Wait for Vite to initialize
        
        # Open browser
        url = "http://localhost:3000"
        print(f"Opening browser at {url}")
        webbrowser.open(url)
        
        # Keep the script running to maintain the process
        process.wait()
    except KeyboardInterrupt:
        print("\nStopping application...")
        process.terminate()
    except Exception as e:
        print(f"Error: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    run_app()
