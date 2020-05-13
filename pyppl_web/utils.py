"""Some utility functions for pyppl_web"""
from socket import socket

def auto_port() -> int:
    """Find an available port"""
    with socket() as sock:
        sock.bind(('', 0))
        return sock.getsockname()[1]
