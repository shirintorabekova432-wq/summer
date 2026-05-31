import http.server
import socketserver
import webbrowser
import threading
import sys
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server.")
        httpd.serve_forever()

if __name__ == "__main__":
    # Change working directory to the directory of this script
    os.chdir(DIRECTORY)
    
    # Run the server in a separate thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Open web browser
    print(f"Opening Summer Reading Challenge at http://localhost:{PORT}...")
    webbrowser.open(f"http://localhost:{PORT}/index.html")
    
    # Keep main thread alive to capture KeyboardInterrupt
    try:
        while True:
            server_thread.join(1)
    except KeyboardInterrupt:
        print("\nStopping server. Goodbye!")
        sys.exit(0)
